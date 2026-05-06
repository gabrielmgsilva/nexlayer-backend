import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { paginate, getPrismaPage } from '../../shared/utils/paginate';

const STATUS_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  PENDING:   [SaleStatus.CONFIRMED, SaleStatus.CANCELLED],
  CONFIRMED: [SaleStatus.SHIPPED, SaleStatus.CANCELLED],
  SHIPPED:   [SaleStatus.DELIVERED, SaleStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  // ── Channels ─────────────────────────────────────────────────

  async findAllChannels(options?: { includeInactive?: boolean }) {
    return this.prisma.salesChannel.findMany({
      where: options?.includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOneChannel(id: string, options?: { activeOnly?: boolean }) {
    const ch = await this.prisma.salesChannel.findUnique({ where: { id } });
    if (!ch) throw new NotFoundException('Canal não encontrado');
    if (options?.activeOnly && !ch.isActive) {
      throw new BadRequestException('Canal inativo. Ative o canal para usar em vendas.');
    }
    return ch;
  }

  async findOneCustomer(id: string, options?: { activeOnly?: boolean }) {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    if (options?.activeOnly && !customer.isActive) {
      throw new BadRequestException('Cliente inativo. Ative o cliente para usar em vendas.');
    }
    return customer;
  }

  async createChannel(dto: CreateChannelDto) {
    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.salesChannel.create({ data: dto });

      const products = await tx.product.findMany({
        where: { deletedAt: null },
        select: { id: true, sellingPrice: true },
      });

      if (products.length > 0) {
        const data: Prisma.ProductChannelPriceCreateManyInput[] = [];

        for (const product of products) {
          const snapshotPrice = product.sellingPrice != null
            ? null
            : await this.getLatestSnapshotUnitSalePrice(tx, product.id);

          const basePrice = product.sellingPrice != null
            ? Number(product.sellingPrice)
            : (snapshotPrice ?? 0);

          data.push({
            productId: product.id,
            channelId: channel.id,
            price: this.calculateChannelPrice(basePrice, channel),
          });
        }

        await tx.productChannelPrice.createMany({ data });
      }

      return channel;
    });
  }

  async updateChannel(id: string, dto: UpdateChannelDto) {
    await this.findOneChannel(id);
    return this.prisma.salesChannel.update({ where: { id }, data: dto });
  }

  async removeChannel(id: string) {
    await this.findOneChannel(id);
    const orders = await this.prisma.saleOrder.count({ where: { channelId: id } });
    if (orders > 0) {
      throw new BadRequestException(
        `Canal possui ${orders} venda(s). Remova-as antes ou desative o canal.`,
      );
    }
    return this.prisma.salesChannel.delete({ where: { id } });
  }

  // ── Sale Orders ──────────────────────────────────────────────

  async findAll(filters?: {
    status?: SaleStatus;
    channelId?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, ...rest } = filters ?? {};
    const where: Record<string, unknown> = {};
    if (rest.status) where.status = rest.status;
    if (rest.channelId) where.channelId = rest.channelId;
    if (rest.customerId) where.customerId = rest.customerId;

    const [data, total] = await Promise.all([
      this.prisma.saleOrder.findMany({
        where,
        include: {
          channel: { select: { id: true, name: true, commissionPercent: true } },
          customer: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
              variation: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.saleOrder.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id },
      include: {
        channel: true,
        customer: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variation: { select: { id: true, name: true, sku: true } },
            productionJob: { select: { id: true, jobNumber: true, status: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Venda não encontrada');
    return order;
  }

  async create(dto: CreateSaleDto) {
    await this.findOneChannel(dto.channelId, { activeOnly: true });
    if (dto.customerId) {
      await this.findOneCustomer(dto.customerId, { activeOnly: true });
    }
    if (dto.items.length === 0) {
      throw new BadRequestException('A venda precisa de pelo menos 1 item');
    }

    // Look up latest unit cost from CostSnapshot for each product
    const costMap = new Map<string, number>();
    for (const item of dto.items) {
      if (item.costPerUnit) continue;
      if (costMap.has(item.productId)) continue;
      const snap = await this.prisma.costSnapshot.findFirst({
        where: { productionJob: { productId: item.productId } },
        orderBy: { generatedAt: 'desc' },
        select: { unitCostWithError: true },
      });
      if (snap) costMap.set(item.productId, Number(snap.unitCostWithError));
    }

    const orderNumber = await this.generateOrderNumber();

    const order = await this.prisma.saleOrder.create({
      data: {
        orderNumber,
        channelId: dto.channelId,
        customerId: dto.customerId || null,
        shippingCost: dto.shippingCost ?? 0,
        discount: dto.discount ?? 0,
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            variationId: item.variationId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPerUnit: item.costPerUnit ?? costMap.get(item.productId) ?? 0,
          })),
        },
      },
    });

    return this.findOne(order.id);
  }

  async update(id: string, dto: UpdateSaleDto) {
    const order = await this.findOne(id);
    if (order.status !== SaleStatus.PENDING) {
      throw new BadRequestException('Só é possível editar vendas com status PENDING');
    }
    if (dto.channelId) {
      await this.findOneChannel(dto.channelId, { activeOnly: true });
    }
    if (dto.customerId) {
      await this.findOneCustomer(dto.customerId, { activeOnly: true });
    }
    return this.prisma.saleOrder.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const order = await this.findOne(id);
    if (order.status !== SaleStatus.PENDING) {
      throw new BadRequestException('Só é possível remover vendas com status PENDING');
    }
    return this.prisma.saleOrder.delete({ where: { id } });
  }

  // ── Status transitions ───────────────────────────────────────

  async updateStatus(id: string, newStatus: SaleStatus) {
    const order = await this.findOne(id);
    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transição inválida: ${order.status} → ${newStatus}. Permitido: ${allowed.join(', ')}`,
      );
    }

    const updates: Record<string, unknown> = { status: newStatus };

    if (newStatus === SaleStatus.CONFIRMED) {
      updates.confirmedAt = new Date();
      await this.handleConfirm(order);
    }
    if (newStatus === SaleStatus.SHIPPED) {
      updates.shippedAt = new Date();
    }
    if (newStatus === SaleStatus.DELIVERED) {
      updates.deliveredAt = new Date();
    }
    if (newStatus === SaleStatus.CANCELLED) {
      updates.cancelledAt = new Date();
      await this.handleCancel(order);
    }

    await this.prisma.saleOrder.update({ where: { id }, data: updates });
    return this.findOne(id);
  }

  // ── Confirm: deduct stock or create production job ───────────

  private async handleConfirm(
    order: Awaited<ReturnType<SalesService['findOne']>>,
  ) {
    for (const item of order.items) {
      // Se já tem job vinculado (criado via calculadora), pular criação automática
      if (item.productionJobId) {
        // Apenas deduzir estoque disponível
        const hasVariation = !!item.variationId;
        let currentStock: number;
        if (hasVariation) {
          const variation = await this.prisma.productVariation.findUnique({ where: { id: item.variationId! } });
          currentStock = variation?.stockQuantity ?? 0;
        } else {
          const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
          currentStock = product?.stockQuantity ?? 0;
        }
        const toDeduct = Math.min(currentStock, item.quantity);
        if (toDeduct > 0) {
          if (hasVariation) {
            await this.prisma.productVariation.update({ where: { id: item.variationId! }, data: { stockQuantity: { decrement: toDeduct } } });
          } else {
            await this.prisma.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: toDeduct } } });
          }
        }
        await this.prisma.saleItem.update({
          where: { id: item.id },
          data: { fulfilledFromStock: toDeduct >= item.quantity },
        });
        continue;
      }

      // Check variation or product stock
      const hasVariation = !!item.variationId;
      let currentStock: number;

      if (hasVariation) {
        const variation = await this.prisma.productVariation.findUnique({
          where: { id: item.variationId! },
        });
        currentStock = variation?.stockQuantity ?? 0;
      } else {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
        });
        currentStock = product?.stockQuantity ?? 0;
      }

      if (currentStock >= item.quantity) {
        // Deduct from stock
        if (hasVariation) {
          await this.prisma.productVariation.update({
            where: { id: item.variationId! },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        } else {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }
        await this.prisma.saleItem.update({
          where: { id: item.id },
          data: { fulfilledFromStock: true },
        });
      } else {
        // Deduct whatever is available
        const fromStock = currentStock;
        const deficit = item.quantity - fromStock;

        if (fromStock > 0) {
          if (hasVariation) {
            await this.prisma.productVariation.update({
              where: { id: item.variationId! },
              data: { stockQuantity: 0 },
            });
          } else {
            await this.prisma.product.update({
              where: { id: item.productId },
              data: { stockQuantity: 0 },
            });
          }
        }

        // Create production job for the deficit
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: { category: true },
        });
        if (!product) continue;

        const jobNumber = await this.generateJobNumber();
        // Find a default cost config
        const costConfig = await this.prisma.costConfig.findFirst({
          where: { isDefault: true },
        });
        if (!costConfig) continue; // Cannot create job without cost config

        const piecesPerPrint = product.piecesPerPrint;
        const printsNeeded = Math.ceil(deficit / piecesPerPrint);
        const totalPiecesProduced = printsNeeded * piecesPerPrint;

        const job = await this.prisma.productionJob.create({
          data: {
            jobNumber,
            customerId: order.customerId,
            productId: item.productId,
            productionMode: deficit === 1 ? 'SINGLE_PIECE' : 'BATCH',
            quantityOrdered: deficit,
            piecesPerPrint,
            printsNeeded,
            printTimeMinutes: product.estimatedPrintTimeMinutes,
            materialPerPrintG: product.estimatedMaterialG,
            costConfigId: costConfig.id,
            profitMargin: 0.3,
            batchStrategy: 'FULL_PRINTS',
            totalPiecesProduced,
            extraPiecesProduced: totalPiecesProduced - deficit,
            priority: 2,
            notes: `Gerado automaticamente pela venda ${order.orderNumber}`,
            quotedAt: new Date(),
          },
        });

        await this.prisma.saleItem.update({
          where: { id: item.id },
          data: {
            productionJobId: job.id,
            fulfilledFromStock: fromStock > 0,
          },
        });
      }
    }
  }

  // ── Cancel: restock items that were deducted ─────────────────

  private async handleCancel(
    order: Awaited<ReturnType<SalesService['findOne']>>,
  ) {
    for (const item of order.items) {
      if (!item.fulfilledFromStock) continue;

      // Restock
      if (item.variationId) {
        await this.prisma.productVariation.update({
          where: { id: item.variationId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      } else {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const prefix = `VND-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastOrder = await this.prisma.saleOrder.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
    });
    const seq = lastOrder
      ? parseInt(lastOrder.orderNumber.split('-').pop()!, 10) + 1
      : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private async generateJobNumber(): Promise<string> {
    const now = new Date();
    const prefix = `JOB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const last = await this.prisma.productionJob.findFirst({
      where: { jobNumber: { startsWith: prefix } },
      orderBy: { jobNumber: 'desc' },
    });
    const seq = last
      ? parseInt(last.jobNumber.split('-').pop()!, 10) + 1
      : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }

  private async getLatestSnapshotUnitSalePrice(
    tx: Prisma.TransactionClient,
    productId: string,
  ): Promise<number | null> {
    const snapshot = await tx.costSnapshot.findFirst({
      where: { productionJob: { productId } },
      orderBy: { generatedAt: 'desc' },
      select: { unitSalePrice: true },
    });
    if (!snapshot) return null;
    return Number(snapshot.unitSalePrice);
  }

  private calculateChannelPrice(
    baseSalePrice: number,
    channel: {
      commissionPercent: Prisma.Decimal | number;
      feeFixed: Prisma.Decimal | number;
      feePercentVariable: Prisma.Decimal | number;
    },
  ) {
    const base = Math.max(0, Number(baseSalePrice) || 0);
    if (base <= 0) return 0;

    const commission = Math.max(0, Number(channel.commissionPercent) || 0);
    const variableFee = Math.max(0, Number(channel.feePercentVariable) || 0);
    const fixedFee = Math.max(0, Number(channel.feeFixed) || 0);
    const totalPercent = (commission + variableFee) / 100;

    if (totalPercent >= 0.99) {
      return this.roundCurrency(base + fixedFee);
    }
    return this.roundCurrency((base + fixedFee) / (1 - totalPercent));
  }

  private roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
  }
}
