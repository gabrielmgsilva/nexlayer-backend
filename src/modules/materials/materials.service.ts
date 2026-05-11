import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../../shared/alerts/alerts.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CreateMaterialStockDto } from './dto/create-stock.dto';
import { UpdateMaterialStockDto } from './dto/update-stock.dto';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { paginate, getPrismaPage } from '../../shared/utils/paginate';

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private alerts: AlertsService,
  ) {}

  async findAll(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const where = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        include: {
          supplier:     { select: { id: true, name: true } },
          filamentType: { select: { id: true, name: true } },
          brand:        { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.material.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, deletedAt: null },
      include: {
        supplier:     { select: { id: true, name: true } },
        filamentType: { select: { id: true, name: true } },
        brand:        { select: { id: true, name: true } },
        stocks: { where: { status: { not: 'EMPTY' } } },
      },
    });
    if (!material) throw new NotFoundException('Material não encontrado');
    return material;
  }

  create(dto: CreateMaterialDto) {
    return this.prisma.material.create({ data: dto });
  }

  async update(id: string, dto: UpdateMaterialDto) {
    await this.findOne(id);
    return this.prisma.material.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Regra 10: não remover se há jobs ativos usando este material
    const activeJobs = await this.prisma.productionJob.count({
      where: {
        materialStock: { materialId: id },
        status: { notIn: ['DELIVERED', 'CANCELLED', 'QC_REJECTED'] },
      },
    });
    if (activeJobs > 0) {
      throw new BadRequestException(
        `Material está em uso em ${activeJobs} job(s) ativo(s).`,
      );
    }
    return this.prisma.material.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStocks(materialId: string, pagination: PaginationDto) {
    await this.findOne(materialId);
    const { page = 1, limit = 20 } = pagination;
    const where = { materialId };
    const [data, total] = await Promise.all([
      this.prisma.materialStock.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.materialStock.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async createStock(materialId: string, dto: CreateMaterialStockDto) {
    await this.findOne(materialId);
    return this.prisma.materialStock.create({
      data: {
        materialId,
        initialWeightG: dto.initialWeightG,
        currentWeightG: dto.initialWeightG,
        lotNumber: dto.lotNumber,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
        openedDate: dto.openedDate ? new Date(dto.openedDate) : undefined,
        status: dto.status ?? 'SEALED',
        costPerKg: dto.costPerKg ?? 0,
        colorHex: dto.colorHex ?? null,
        colorIsRainbow: dto.colorIsRainbow ?? false,
        colorIsIncolor: dto.colorIsIncolor ?? false,
      },
    });
  }

  // ── updateStock: fluxo completo ──────────────────────────────
  async updateStock(stockId: string, dto: UpdateMaterialStockDto) {
    const stock = await this.prisma.materialStock.findUnique({ where: { id: stockId } });
    if (!stock) throw new NotFoundException('Estoque não encontrado');

    const data: Parameters<typeof this.prisma.materialStock.update>[0]['data'] = {};

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.lotNumber !== undefined) data.lotNumber = dto.lotNumber;
    if (dto.openedDate !== undefined) data.openedDate = new Date(dto.openedDate);
    if (dto.costPerKg !== undefined) data.costPerKg = dto.costPerKg;
    if ('colorHex' in dto) data.colorHex = dto.colorHex ?? null;
    if (dto.colorIsRainbow !== undefined) data.colorIsRainbow = dto.colorIsRainbow;
    if (dto.colorIsIncolor !== undefined) data.colorIsIncolor = dto.colorIsIncolor;

    if (dto.currentWeightG !== undefined) {
      if (dto.currentWeightG > stock.initialWeightG) {
        throw new BadRequestException(
          `Peso atual (${dto.currentWeightG}g) não pode exceder o peso inicial (${stock.initialWeightG}g). Use uma transação de PURCHASE para recarregar.`,
        );
      }
      data.currentWeightG = dto.currentWeightG;
      // Ajuste de status automático por peso
      if (dto.currentWeightG === 0) data.status = 'EMPTY';
      else if (stock.status === 'SEALED' && dto.currentWeightG < stock.initialWeightG) {
        data.status = 'IN_USE';
      }

      // Registrar como transação de ADJUSTMENT
      const diff = dto.currentWeightG - stock.currentWeightG;
      await this.prisma.materialStockTransaction.create({
        data: {
          materialStockId: stockId,
          type: 'ADJUSTMENT',
          quantityG: diff,
          notes: `Ajuste manual: ${stock.currentWeightG}g → ${dto.currentWeightG}g`,
        },
      });
    }

    const updated = await this.prisma.materialStock.update({
      where: { id: stockId },
      data,
    });

    // Regra 8: verificar alerta de estoque após ajuste
    const alert = await this.alerts.checkMaterialStockAlert(stockId);

    return { stock: updated, alert: alert ?? undefined };
  }

  async createTransaction(stockId: string, dto: CreateStockTransactionDto) {
    const stock = await this.prisma.materialStock.findUnique({ where: { id: stockId } });
    if (!stock) throw new NotFoundException('Estoque não encontrado');

    const newWeight = stock.currentWeightG + dto.quantityG;
    if (newWeight < 0) {
      throw new BadRequestException(
        `Quantidade insuficiente. Disponível: ${stock.currentWeightG}g, solicitado: ${Math.abs(dto.quantityG)}g`,
      );
    }

    const newStatus =
      newWeight <= 0
        ? 'EMPTY'
        : stock.status === 'SEALED' && dto.type === 'CONSUMPTION'
          ? 'IN_USE'
          : stock.status;

    const [transaction] = await this.prisma.$transaction([
      this.prisma.materialStockTransaction.create({
        data: {
          materialStockId: stockId,
          type: dto.type,
          quantityG: dto.quantityG,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          notes: dto.notes,
        },
      }),
      this.prisma.materialStock.update({
        where: { id: stockId },
        data: { currentWeightG: newWeight, status: newStatus },
      }),
    ]);

    // Regra 8: verificar alerta de estoque após consumo
    const alert =
      dto.type === 'CONSUMPTION' || dto.type === 'WASTE'
        ? await this.alerts.checkMaterialStockAlert(stockId)
        : null;

    return { transaction, alert: alert ?? undefined };
  }
}
