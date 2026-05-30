import {
  Injectable, NotFoundException, Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePrintFailureDto } from './dto/create-print-failure.dto';
import { FilterPrintFailuresDto } from './dto/filter-print-failures.dto';

@Injectable()
export class PrintFailuresService {
  private readonly logger = new Logger(PrintFailuresService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FilterPrintFailuresDto) {
    const {
      page = 1, limit = 50,
      equipmentId, materialId, productId,
      failureCategory, failureSeverity, from, to,
    } = filter;

    const where: Record<string, unknown> = {};
    if (equipmentId) where.equipmentId = equipmentId;
    if (materialId)  where.materialId  = materialId;
    if (productId)   where.productId   = productId;
    if (failureCategory) where.failureCategory = failureCategory;
    if (failureSeverity) where.failureSeverity = failureSeverity;
    if (from || to) {
      where.occurredAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    try {
      const [data, total] = await Promise.all([
        this.prisma.printFailure.findMany({
          where,
          include: {
            equipment: { select: { id: true, name: true, model: true } },
            product:   { select: { id: true, name: true } },
            material:  { select: { id: true, filamentType: { select: { name: true } }, brand: { select: { name: true } } } },
            printAttempt: { select: { id: true, attemptNumber: true, productionJobId: true } },
          },
          orderBy: { occurredAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.printFailure.count({ where }),
      ]);

      return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    } catch (err) {
      this.logger.error('Erro ao listar falhas de impressão', err);
      throw new InternalServerErrorException('Falha ao listar registros');
    }
  }

  async findOne(id: string) {
    const failure = await this.prisma.printFailure.findUnique({
      where: { id },
      include: {
        equipment:    { select: { id: true, name: true, model: true } },
        product:      { select: { id: true, name: true } },
        material:     { select: { id: true, filamentType: { select: { name: true } }, brand: { select: { name: true } } } },
        printAttempt: { select: { id: true, attemptNumber: true, productionJobId: true } },
      },
    });
    if (!failure) throw new NotFoundException('Registro de falha não encontrado');
    return failure;
  }

  async create(dto: CreatePrintFailureDto) {
    this.logger.log(`Registrando falha em equipamento ${dto.equipmentId}`);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Create a linked PrintAttempt (status FAILED)
        const attempt = await tx.printAttempt.create({
          data: {
            productionJobId: dto.productionJobId ?? await this.getOrCreateDummyJobId(tx, dto.equipmentId),
            equipmentId: dto.equipmentId,
            attemptNumber: 1,
            status: 'FAILED',
            piecesExpected: 0,
            piecesOk: 0,
            piecesDefective: 0,
            materialWastedG: dto.materialWastedG,
            occurredAt: new Date(dto.occurredAt),
          } as any,
        });

        const failure = await tx.printFailure.create({
          data: {
            printAttemptId:   attempt.id,
            equipmentId:      dto.equipmentId,
            productId:        dto.productId        ?? null,
            materialId:       dto.materialId       ?? null,
            failureCategory:  dto.failureCategory  as any,
            failureSeverity:  dto.failureSeverity  as any,
            materialWastedG:  dto.materialWastedG,
            timeWastedMinutes: dto.timeWastedMinutes,
            reprintRequired:  dto.reprintRequired,
            detectedAtLayer:  dto.detectedAtLayer  ?? null,
            detectedAtPercent: dto.detectedAtPercent ?? null,
            ambientTempC:     dto.ambientTempC     ?? null,
            humidityPercent:  dto.humidityPercent  ?? null,
            nozzleHours:      dto.nozzleHours      ?? null,
            rootCause:        dto.rootCause        ?? null,
            correctiveAction: dto.correctiveAction ?? null,
            notes:            dto.notes            ?? null,
            occurredAt:       new Date(dto.occurredAt),
          },
        });

        // Update equipment totalPrintHours wasted (optional — non-blocking)
        await tx.equipment.update({
          where: { id: dto.equipmentId },
          data: { totalPrintHours: { increment: dto.timeWastedMinutes / 60 } },
        }).catch(() => {/* non-critical */});

        this.logger.log(`Falha registrada: ${failure.id}`);
        return failure;
      });
    } catch (err) {
      this.logger.error('Erro ao registrar falha de impressão', err?.stack ?? err);
      throw new InternalServerErrorException('Falha ao registrar ocorrência');
    }
  }

  async update(id: string, data: Partial<CreatePrintFailureDto>) {
    await this.findOne(id);
    try {
      return await this.prisma.printFailure.update({
        where: { id },
        data: {
          ...(data.failureCategory  ? { failureCategory:  data.failureCategory  as any } : {}),
          ...(data.failureSeverity  ? { failureSeverity:  data.failureSeverity  as any } : {}),
          ...(data.materialWastedG  !== undefined ? { materialWastedG:  data.materialWastedG  } : {}),
          ...(data.timeWastedMinutes !== undefined ? { timeWastedMinutes: data.timeWastedMinutes } : {}),
          ...(data.reprintRequired  !== undefined ? { reprintRequired:  data.reprintRequired  } : {}),
          ...(data.rootCause        !== undefined ? { rootCause:        data.rootCause        } : {}),
          ...(data.correctiveAction !== undefined ? { correctiveAction: data.correctiveAction } : {}),
          ...(data.notes            !== undefined ? { notes:            data.notes            } : {}),
          ...(data.ambientTempC     !== undefined ? { ambientTempC:     data.ambientTempC     } : {}),
          ...(data.humidityPercent  !== undefined ? { humidityPercent:  data.humidityPercent  } : {}),
          ...(data.nozzleHours      !== undefined ? { nozzleHours:      data.nozzleHours      } : {}),
          ...(data.occurredAt       ? { occurredAt: new Date(data.occurredAt) } : {}),
        },
      });
    } catch (err) {
      this.logger.error(`Erro ao atualizar falha ${id}`, err);
      throw new InternalServerErrorException('Falha ao atualizar registro');
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.printFailure.delete({ where: { id } });
      this.logger.log(`Falha ${id} removida`);
    } catch (err) {
      this.logger.error(`Erro ao remover falha ${id}`, err);
      throw new InternalServerErrorException('Falha ao remover registro');
    }
  }

  async getAnalytics(from?: string, to?: string) {
    const dateFilter = (from || to) ? {
      occurredAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      },
    } : {};

    try {
      const [
        totalCount,
        byCategoryRaw,
        bySeverityRaw,
        byEquipmentRaw,
        aggregates,
      ] = await Promise.all([
        this.prisma.printFailure.count({ where: dateFilter }),

        this.prisma.printFailure.groupBy({
          by: ['failureCategory'],
          where: dateFilter,
          _count: { _all: true },
          _sum: { materialWastedG: true, timeWastedMinutes: true },
          orderBy: { _count: { failureCategory: 'desc' } },
        }),

        this.prisma.printFailure.groupBy({
          by: ['failureSeverity'],
          where: dateFilter,
          _count: { _all: true },
        }),

        this.prisma.printFailure.groupBy({
          by: ['equipmentId'],
          where: dateFilter,
          _count: { _all: true },
          _sum: { materialWastedG: true },
          orderBy: { _count: { equipmentId: 'desc' } },
          take: 5,
        }),

        this.prisma.printFailure.aggregate({
          where: dateFilter,
          _sum: { materialWastedG: true, timeWastedMinutes: true },
          _avg: { materialWastedG: true, timeWastedMinutes: true },
        }),
      ]);

      // Resolve equipment names
      const equipmentIds = byEquipmentRaw.map((e) => e.equipmentId);
      const equipments = await this.prisma.equipment.findMany({
        where: { id: { in: equipmentIds } },
        select: { id: true, name: true },
      });
      const equipMap = Object.fromEntries(equipments.map((e) => [e.id, e.name]));

      return {
        totalCount,
        totalMaterialWastedG:   Number(aggregates._sum.materialWastedG ?? 0),
        totalTimeWastedMinutes: Number(aggregates._sum.timeWastedMinutes ?? 0),
        avgMaterialWastedG:     Number(aggregates._avg.materialWastedG ?? 0),
        byCategory: byCategoryRaw.map((r) => ({
          category:         r.failureCategory,
          count:            r._count._all,
          materialWastedG:  Number(r._sum.materialWastedG ?? 0),
          timeWastedMinutes:Number(r._sum.timeWastedMinutes ?? 0),
        })),
        bySeverity: bySeverityRaw.map((r) => ({
          severity: r.failureSeverity,
          count:    r._count._all,
        })),
        byEquipment: byEquipmentRaw.map((r) => ({
          equipmentId:     r.equipmentId,
          equipmentName:   equipMap[r.equipmentId] ?? r.equipmentId,
          count:           r._count._all,
          materialWastedG: Number(r._sum.materialWastedG ?? 0),
        })),
      };
    } catch (err) {
      this.logger.error('Erro ao gerar analytics de falhas', err);
      throw new InternalServerErrorException('Falha ao gerar analytics');
    }
  }

  // Creates a minimal "standalone" job to satisfy the FK constraint
  // when a failure is registered without a production job reference
  private async getOrCreateDummyJobId(tx: any, equipmentId: string): Promise<string> {
    // Find a default cost config
    const costConfig = await tx.costConfig.findFirst({ where: { isDefault: true } });
    if (!costConfig) throw new InternalServerErrorException('Configure um centro de custo padrão antes de registrar falhas avulsas');

    // Find any product to satisfy FK
    const product = await tx.product.findFirst({ select: { id: true } });
    if (!product) throw new InternalServerErrorException('Cadastre ao menos um produto antes de registrar falhas avulsas');

    const job = await tx.productionJob.create({
      data: {
        jobNumber:          `FAIL-${Date.now()}`,
        productId:          product.id,
        equipmentId,
        productionMode:     'SINGLE_PIECE',
        quantityOrdered:    1,
        piecesPerPrint:     1,
        printsNeeded:       1,
        printTimeMinutes:   0,
        materialPerPrintG:  0,
        costConfigId:       costConfig.id,
        profitMargin:       0,
        batchStrategy:      'FULL_PRINTS',
        status:             'CANCELLED',
      },
    });
    return job.id;
  }
}
