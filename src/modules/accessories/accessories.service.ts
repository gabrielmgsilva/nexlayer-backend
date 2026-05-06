import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../../shared/alerts/alerts.service';
import { CreateAccessoryDto } from './dto/create-accessory.dto';
import { UpdateAccessoryDto } from './dto/update-accessory.dto';
import { CreateAccessoryTransactionDto } from './dto/create-transaction.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { paginate, getPrismaPage } from '../../shared/utils/paginate';

@Injectable()
export class AccessoriesService {
  constructor(
    private prisma: PrismaService,
    private alerts: AlertsService,
  ) {}

  private calcCostPerUnit(purchaseCost: number, purchaseQuantity: number): number {
    return parseFloat((purchaseCost / purchaseQuantity).toFixed(4));
  }

  async findAll(pagination: PaginationDto, categoryId?: string) {
    const { page = 1, limit = 20 } = pagination;
    const where = {
      deletedAt: null as null,
      ...(categoryId ? { categoryId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.accessory.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          unit:     { select: { id: true, name: true, symbol: true } },
        },
        orderBy: { name: 'asc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.accessory.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const acc = await this.prisma.accessory.findFirst({
      where: { id, deletedAt: null },
      include: {
        supplier: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        unit:     { select: { id: true, name: true, symbol: true } },
        priceHistory: { orderBy: { purchasedAt: 'desc' }, take: 10 },
      },
    });
    if (!acc) throw new NotFoundException('Acessório não encontrado');
    return acc;
  }

  create(dto: CreateAccessoryDto) {
    const costPerUnit = this.calcCostPerUnit(dto.purchaseCost, dto.purchaseQuantity);
    return this.prisma.accessory.create({
      data: { ...dto, costPerUnit, stockQuantity: dto.stockQuantity ?? 0 },
    });
  }

  async update(id: string, dto: UpdateAccessoryDto) {
    const acc = await this.findOne(id);
    const purchaseCost = dto.purchaseCost ?? Number(acc.purchaseCost);
    const purchaseQuantity = dto.purchaseQuantity ?? Number(acc.purchaseQuantity);
    const costPerUnit = this.calcCostPerUnit(purchaseCost, purchaseQuantity);
    return this.prisma.accessory.update({ where: { id }, data: { ...dto, costPerUnit } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.accessory.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async createTransaction(accessoryId: string, dto: CreateAccessoryTransactionDto) {
    const acc = await this.findOne(accessoryId);
    const newQty = Number(acc.stockQuantity) + dto.quantity;

    if (newQty < 0) {
      const unitSymbol = (acc.unit as { symbol?: string } | null)?.symbol ?? '';
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${acc.stockQuantity} ${unitSymbol}`,
      );
    }

    const updates: Parameters<typeof this.prisma.accessory.update>[0]['data'] = {
      stockQuantity: newQty,
    };

    if (dto.type === 'PURCHASE' && dto.purchaseCost && dto.purchaseQuantity) {
      const newCostPerUnit = this.calcCostPerUnit(dto.purchaseCost, dto.purchaseQuantity);
      updates.purchaseCost = dto.purchaseCost;
      updates.purchaseQuantity = dto.purchaseQuantity;
      updates.costPerUnit = newCostPerUnit;
      if (dto.purchaseMode) updates.purchaseMode = dto.purchaseMode;

      await this.prisma.accessoryPriceHistory.create({
        data: {
          accessoryId,
          purchaseMode: dto.purchaseMode ?? acc.purchaseMode,
          purchaseQuantity: dto.purchaseQuantity,
          purchaseCost: dto.purchaseCost,
          costPerUnit: newCostPerUnit,
          supplierId: dto.supplierId,
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
          notes: dto.notes,
        },
      });
    }

    const unitCost = dto.unitCost ?? Number(acc.costPerUnit);

    const [transaction] = await this.prisma.$transaction([
      this.prisma.accessoryTransaction.create({
        data: {
          accessoryId,
          type: dto.type,
          quantity: dto.quantity,
          unitCost,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          notes: dto.notes,
        },
      }),
      this.prisma.accessory.update({ where: { id: accessoryId }, data: updates }),
    ]);

    // Regra 8: verificar alerta após consumo
    const alert =
      dto.type === 'CONSUMPTION'
        ? await this.alerts.checkAccessoryStockAlert(accessoryId)
        : null;

    return { transaction, alert: alert ?? undefined };
  }
}
