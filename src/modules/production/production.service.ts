import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from '../../shared/alerts/alerts.service';
import { STORAGE_SERVICE, IStorageService } from '../../shared/storage/storage.interface';
import { CostEngineService } from './cost-engine.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

const ACTIVE_STATUSES: JobStatus[] = [
  JobStatus.QUOTED,
  JobStatus.QUEUED,
  JobStatus.PRINTING,
  JobStatus.POST_PROCESSING,
  JobStatus.QUALITY_CHECK,
  JobStatus.QC_APPROVED,
  JobStatus.QC_PARTIAL_APPROVED,
  JobStatus.PACKING,
  JobStatus.READY,
];
const FINISHED_STATUSES: JobStatus[] = [
  JobStatus.DELIVERED,
  JobStatus.CANCELLED,
  JobStatus.QC_REJECTED,
];

// Transições de status permitidas (máquina de estados)
const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  QUOTED: [JobStatus.QUEUED, JobStatus.CANCELLED],
  QUEUED: [JobStatus.PRINTING, JobStatus.CANCELLED],
  PRINTING: [JobStatus.POST_PROCESSING, JobStatus.QUALITY_CHECK, JobStatus.CANCELLED],
  POST_PROCESSING: [JobStatus.QUALITY_CHECK, JobStatus.PACKING, JobStatus.CANCELLED],
  QUALITY_CHECK: [
    JobStatus.QC_APPROVED,
    JobStatus.QC_PARTIAL_APPROVED,
    JobStatus.QC_REJECTED,
    JobStatus.CANCELLED,
  ],
  QC_APPROVED: [JobStatus.PACKING, JobStatus.CANCELLED],
  QC_PARTIAL_APPROVED: [JobStatus.PACKING, JobStatus.CANCELLED],
  QC_REJECTED: [],
  PACKING: [JobStatus.READY, JobStatus.CANCELLED],
  READY: [JobStatus.DELIVERED, JobStatus.CANCELLED],
  DELIVERED: [],
  CANCELLED: [],
};

const MATERIAL_CONSUMPTION_STATUSES = new Set<JobStatus>([
  JobStatus.QC_APPROVED,
  JobStatus.QC_PARTIAL_APPROVED,
  JobStatus.QC_REJECTED,
  JobStatus.PACKING,
  JobStatus.READY,
  JobStatus.DELIVERED,
]);

const COMPLETION_STATUSES = new Set<JobStatus>([
  JobStatus.QC_REJECTED,
  JobStatus.READY,
  JobStatus.DELIVERED,
]);

let jobCounter = 1;

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private costEngine: CostEngineService,
    private alerts: AlertsService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async findAll(filters?: {
    status?: JobStatus;
    customerId?: string;
    productId?: string;
    statusGroup?: 'active' | 'finished';
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.productId) where.productId = filters.productId;
    if (filters?.statusGroup === 'active') where.status = { in: ACTIVE_STATUSES };
    if (filters?.statusGroup === 'finished') where.status = { in: FINISHED_STATUSES };

    return this.prisma.productionJob.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            name: true,
            channelPrices: {
              include: {
                channel: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        equipment: { select: { id: true, name: true } },
        costSnapshots: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { unitSalePrice: true, batchTotalSalePrice: true, unitCostWithError: true, version: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const job = await this.prisma.productionJob.findUnique({
      where: { id },
      include: {
        customer: true,
        product: {
          include: {
            category: true,
            channelPrices: {
              include: {
                channel: {
                  select: {
                    id: true,
                    name: true,
                    commissionPercent: true,
                    feeFixed: true,
                    feePercentVariable: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        equipment: true,
        materialStock: { include: { material: true } },
        jobMaterials: { include: { materialStock: { include: { material: true } } } },
        costConfig: true,
        costSnapshots: { orderBy: { version: 'desc' } },
        printAttempts: { orderBy: { attemptNumber: 'asc' } },
      },
    });
    if (!job) throw new NotFoundException('Job não encontrado');
    return job;
  }

  async create(dto: CreateJobDto) {
    const printsNeeded = Math.ceil(dto.quantityOrdered / dto.piecesPerPrint);
    const totalPiecesProduced =
      dto.batchStrategy === 'EXACT_QUANTITY'
        ? dto.quantityOrdered
        : printsNeeded * dto.piecesPerPrint;
    const extraPiecesProduced = totalPiecesProduced - dto.quantityOrdered;

    // Normalize materials: support legacy single or new array
    const materialItems = dto.jobMaterials?.length
      ? dto.jobMaterials
      : dto.materialStockId && dto.materialPerPrintG
        ? [{ materialStockId: dto.materialStockId, materialPerPrintG: dto.materialPerPrintG }]
        : [];

    // Fetch all stocks
    const stocks = await Promise.all(
      materialItems.map((m) =>
        this.prisma.materialStock.findUnique({ where: { id: m.materialStockId } }),
      ),
    );
    if (stocks.some((s) => !s)) throw new NotFoundException('Carretel não encontrado');

    const jobAccessories = (dto.jobAccessories ?? []).map(async (a) => {
      const acc = await this.prisma.accessory.findUnique({ where: { id: a.accessoryId } });
      return {
        accessory_id: a.accessoryId,
        qty_per_unit: a.qtyPerUnit,
        unit_cost_at_time: acc ? Number(acc.costPerUnit) : 0,
      };
    });
    const resolvedAccessories = await Promise.all(jobAccessories);

    const jobNumber = await this.generateJobNumber();

    // Use first material as the legacy materialStockId/materialPerPrintG for backward compat
    const primaryMaterial = materialItems[0];

    const job = await this.prisma.productionJob.create({
      data: {
        jobNumber,
        customerId: dto.customerId,
        productId: dto.productId,
        equipmentId: dto.equipmentId,
        productionMode: dto.productionMode,
        quantityOrdered: dto.quantityOrdered,
        piecesPerPrint: dto.piecesPerPrint,
        printsNeeded,
        printTimeMinutes: dto.printTimeMinutes,
        materialPerPrintG: primaryMaterial?.materialPerPrintG ?? 0,
        materialStockId: primaryMaterial?.materialStockId,
        jobAccessories: resolvedAccessories,
        costConfigId: dto.costConfigId,
        profitMargin: dto.profitMargin,
        customUnitPrice: dto.customUnitPrice,
        discountPercent: dto.discountPercent,
        batchStrategy: dto.batchStrategy ?? 'FULL_PRINTS',
        totalPiecesProduced,
        extraPiecesProduced,
        priority: dto.priority ?? 3,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        quotedAt: new Date(),
        jobMaterials: {
          create: materialItems.map((m) => ({
            materialStockId: m.materialStockId,
            materialPerPrintG: m.materialPerPrintG,
          })),
        },
      },
    });

    // Gerar CostSnapshot automaticamente
    const costMaterials = stocks.map((s, i) => ({
      materialId: s!.materialId,
      materialPerPrintG: materialItems[i].materialPerPrintG,
    }));
    const snapshot = await this.generateSnapshot(job.id, costMaterials, resolvedAccessories);

    // Se veio de uma venda, vincular job ao item da venda e atualizar preços
    if (dto.saleItemId && snapshot) {
      await this.prisma.saleItem.update({
        where: { id: dto.saleItemId },
        data: {
          productionJobId: job.id,
          unitPrice: snapshot.unitSalePrice,
          costPerUnit: snapshot.unitCostWithError,
        },
      });
    }

    return this.findOne(job.id);
  }

  async update(id: string, dto: UpdateJobDto) {
    const job = await this.findOne(id);
    if (job.status !== JobStatus.QUOTED) {
      throw new BadRequestException(
        'Só é possível editar jobs com status QUOTED',
      );
    }

    const printsNeeded = dto.piecesPerPrint && dto.quantityOrdered
      ? Math.ceil(dto.quantityOrdered / dto.piecesPerPrint)
      : job.printsNeeded;

    const { jobAccessories: dtoAccessories, jobMaterials: _jobMaterials, ...restDto } = dto;
    await this.prisma.productionJob.update({
      where: { id },
      data: {
        ...restDto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        printsNeeded,
        ...(dtoAccessories !== undefined
          ? {
              jobAccessories: await Promise.all(
                dtoAccessories.map(async (a) => {
                  const acc = await this.prisma.accessory.findUnique({ where: { id: a.accessoryId } });
                  return { accessory_id: a.accessoryId, qty_per_unit: a.qtyPerUnit, unit_cost_at_time: acc ? Number(acc.costPerUnit) : 0 };
                }),
              ),
            }
          : {}),
      },
    });

    // Recalcular snapshot
    await this.recalculate(id);
    return this.findOne(id);
  }

  async updateStatus(id: string, newStatus: JobStatus) {
    const job = await this.findOne(id);
    const isStockJob = !job.customerId;
    const allowed = this.getAllowedTransitions(job.status, isStockJob);
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transição inválida: ${job.status} → ${newStatus}. Permitido: ${allowed.join(', ')}`,
      );
    }

    const targetStatus = this.resolveTargetStatus(newStatus, isStockJob);

    const updates: Record<string, unknown> = { status: targetStatus };

    if (targetStatus === JobStatus.PRINTING && !job.startedAt) {
      updates.startedAt = new Date();
      // Marcar equipamento como PRINTING
      if (job.equipmentId) {
        await this.prisma.equipment.update({
          where: { id: job.equipmentId },
          data: { status: 'PRINTING' },
        });
      }
    }

    if (targetStatus === JobStatus.PACKING || (isStockJob && targetStatus === JobStatus.DELIVERED)) {
      // Baixar estoque de acessórios — Regra 8
      updates.__accessoryAlerts = await this.consumeAccessories(job);
    }

    if (COMPLETION_STATUSES.has(targetStatus) && !job.completedAt) {
      updates.completedAt = new Date();
    }

    if (targetStatus === JobStatus.DELIVERED && !job.deliveredAt) {
      updates.deliveredAt = new Date();
    }

    if (MATERIAL_CONSUMPTION_STATUSES.has(targetStatus)) {
      const alreadyConsumedMaterial = await this.hasConsumedMaterial(job.id);

      // Baixar estoque de material (inclui fluxos com reprovação no QC)
      updates.__materialAlert = await this.consumeMaterial(job);

      if (!alreadyConsumedMaterial && job.equipmentId) {
        const printHours = (job.printTimeMinutes * job.printsNeeded) / 60;
        await this.prisma.equipment.update({
          where: { id: job.equipmentId },
          data: {
            totalPrintHours: { increment: printHours },
            status: 'AVAILABLE',
          },
        });
        // Regra 9: verificar alerta de manutenção após incremento de horas
        updates.__equipmentAlert = await this.alerts.checkEquipmentMaintenanceAlert(job.equipmentId);
      }
    }

    if (targetStatus === JobStatus.CANCELLED) {
      // Verificar se precisa estornar consumo já feito
      updates.completedAt = new Date();
    }

    const updatedJob = await this.prisma.productionJob.update({
      where: { id },
      data: {
        status: updates.status as JobStatus,
        ...(updates.startedAt ? { startedAt: updates.startedAt as Date } : {}),
        ...(updates.completedAt ? { completedAt: updates.completedAt as Date } : {}),
        ...(updates.deliveredAt ? { deliveredAt: updates.deliveredAt as Date } : {}),
      },
    });
    return {
      job: updatedJob,
      alerts: {
        equipment: updates.__equipmentAlert ?? undefined,
        material: updates.__materialAlert ?? undefined,
        accessories: (updates.__accessoryAlerts as unknown[])?.filter(Boolean) ?? undefined,
      },
    };
  }

  private getAllowedTransitions(currentStatus: JobStatus, isStockJob: boolean): JobStatus[] {
    if (!isStockJob) return STATUS_TRANSITIONS[currentStatus];

    const stockTransitions: Partial<Record<JobStatus, JobStatus[]>> = {
      POST_PROCESSING: [JobStatus.QUALITY_CHECK, JobStatus.CANCELLED],
      QC_APPROVED: [JobStatus.DELIVERED, JobStatus.CANCELLED],
      QC_PARTIAL_APPROVED: [JobStatus.DELIVERED, JobStatus.CANCELLED],
      PACKING: [JobStatus.DELIVERED, JobStatus.CANCELLED],
      READY: [JobStatus.DELIVERED, JobStatus.CANCELLED],
    };

    return stockTransitions[currentStatus] ?? STATUS_TRANSITIONS[currentStatus];
  }

  private resolveTargetStatus(requestedStatus: JobStatus, isStockJob: boolean): JobStatus {
    if (
      isStockJob
      && (requestedStatus === JobStatus.QC_APPROVED || requestedStatus === JobStatus.QC_PARTIAL_APPROVED)
    ) {
      return JobStatus.DELIVERED;
    }

    return requestedStatus;
  }

  async recalculate(id: string) {
    const job = await this.findOne(id);

    // Build materials array from jobMaterials relation or legacy single material
    const materials = job.jobMaterials?.length
      ? job.jobMaterials.map((jm) => ({
          materialId: jm.materialStock.materialId,
          materialPerPrintG: Number(jm.materialPerPrintG),
        }))
      : job.materialStock
        ? [{ materialId: job.materialStock.material.id, materialPerPrintG: Number(job.materialPerPrintG) }]
        : [];

    if (!materials.length) throw new BadRequestException('Job sem material associado');

    const accessories = job.jobAccessories as Array<{
      accessory_id: string;
      qty_per_unit: number;
      unit_cost_at_time?: number;
    }>;

    await this.generateSnapshot(id, materials, accessories);
    return this.findOne(id);
  }

  getCostHistory(id: string) {
    return this.prisma.costSnapshot.findMany({
      where: { productionJobId: id },
      orderBy: { version: 'desc' },
    });
  }

  // ── Upload de nota fiscal (apenas jobs DELIVERED) ─────────────
  async uploadInvoice(id: string, file: Express.Multer.File) {
    const job = await this.findOne(id);
    if (job.status !== JobStatus.DELIVERED) {
      throw new BadRequestException('Upload de nota fiscal permitido apenas para jobs entregues (DELIVERED)');
    }

    // Remover arquivo anterior do R2 se existir
    if (job.invoiceFileKey) {
      await this.storage.delete(job.invoiceFileKey).catch(() => null);
    }

    const folder = `jobs/${job.customerId ?? 'stock'}/${job.id}/invoices`;
    const result = await this.storage.upload(file, folder);

    return this.prisma.productionJob.update({
      where: { id },
      data: {
        invoiceFileKey: result.key,
        invoiceFileUrl: result.url,
      },
    });
  }

  // ── Clonar job (re-fila) ──────────────────────────────────────
  async cloneJob(id: string) {
    const job = await this.findOne(id);
    const jobNumber = await this.generateJobNumber();

    const accessories = job.jobAccessories as Array<{
      accessory_id: string;
      qty_per_unit: number;
      unit_cost_at_time: number;
    }>;

    const cloned = await this.prisma.productionJob.create({
      data: {
        jobNumber,
        customerId: job.customerId,
        productId: job.productId,
        equipmentId: job.equipmentId,
        productionMode: job.productionMode,
        quantityOrdered: job.quantityOrdered,
        piecesPerPrint: job.piecesPerPrint,
        printsNeeded: job.printsNeeded,
        printTimeMinutes: job.printTimeMinutes,
        materialPerPrintG: job.materialPerPrintG,
        materialStockId: job.materialStockId,
        jobAccessories: accessories,
        costConfigId: job.costConfigId,
        profitMargin: job.profitMargin,
        customUnitPrice: job.customUnitPrice,
        discountPercent: job.discountPercent,
        batchStrategy: job.batchStrategy,
        totalPiecesProduced: job.totalPiecesProduced,
        extraPiecesProduced: job.extraPiecesProduced,
        priority: job.priority,
        notes: job.notes,
        quotedAt: new Date(),
        jobMaterials: {
          create: (job.jobMaterials ?? []).map((jm) => ({
            materialStockId: jm.materialStockId,
            materialPerPrintG: jm.materialPerPrintG,
          })),
        },
      },
    });

    // Gerar CostSnapshot para o novo job
    const costMaterials = job.jobMaterials?.length
      ? job.jobMaterials.map((jm) => ({
          materialId: jm.materialStock.materialId,
          materialPerPrintG: Number(jm.materialPerPrintG),
        }))
      : job.materialStock
        ? [{ materialId: job.materialStock.material.id, materialPerPrintG: Number(job.materialPerPrintG) }]
        : [];

    if (costMaterials.length) {
      await this.generateSnapshot(cloned.id, costMaterials, accessories);
    }

    return this.findOne(cloned.id);
  }

  // ── Privado: gerar snapshot ────────────────────────────────────
  private async generateSnapshot(
    jobId: string,
    materials: Array<{ materialId: string; materialPerPrintG: number }>,
    accessories: Array<{ accessory_id: string; qty_per_unit: number; unit_cost_at_time?: number }>,
  ) {
    const job = await this.prisma.productionJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    if (!job.equipmentId) {
      throw new BadRequestException('Job sem equipamento designado para calcular custo');
    }

    const costInput = {
      equipmentId: job.equipmentId,
      materials,
      printTimeMinutes: job.printTimeMinutes,
      piecesPerPrint: job.piecesPerPrint,
      printsNeeded: job.printsNeeded,
      quantityOrdered: job.quantityOrdered,
      totalPiecesProduced: job.totalPiecesProduced ?? job.quantityOrdered,
      jobAccessories: accessories,
      costConfigId: job.costConfigId,
      profitMargin: Number(job.profitMargin),
      discountPercent: job.discountPercent ? Number(job.discountPercent) : undefined,
      productionMode: job.productionMode,
      batchStrategy: job.batchStrategy,
    };

    const result = await this.costEngine.calculate(costInput);

    const lastSnapshot = await this.prisma.costSnapshot.findFirst({
      where: { productionJobId: jobId },
      orderBy: { version: 'desc' },
    });
    const version = (lastSnapshot?.version ?? 0) + 1;

    const snapshot = await this.prisma.costSnapshot.create({
      data: {
        productionJobId: jobId,
        version,
        productionMode: job.productionMode,
        batchStrategy: job.batchStrategy,
        equipmentName: result.equipmentName,
        equipmentPowerWatts: result.equipmentPowerWatts,
        printTimeMinutes: job.printTimeMinutes,
        printsCount: job.printsNeeded,
        piecesPerPrint: job.piecesPerPrint,
        quantityOrdered: job.quantityOrdered,
        totalPiecesProduced: costInput.totalPiecesProduced,
        printElectricityCost: result.printElectricityCost,
        printDepreciationCost: result.printDepreciationCost,
        printMaintenanceCost: result.printMaintenanceCost,
        printMaterialCost: result.printMaterialCost,
        printTotalCost: result.printTotalCost,
        unitElectricityCost: result.unitElectricityCost,
        unitDepreciationCost: result.unitDepreciationCost,
        unitMaintenanceCost: result.unitMaintenanceCost,
        unitLaborCost: result.unitLaborCost,
        unitOverheadCost: result.unitOverheadCost,
        unitMaterialCost: result.unitMaterialCost,
        materialName: result.materialName,
        materialCostPerKg: result.materialCostPerKg,
        materialGramsPerPrint: result.materialGramsPerPrint,
        materialGramsPerUnit: result.materialGramsPerUnit,
        materialsDetail: JSON.parse(JSON.stringify(result.materialsDetail)),
        unitAccessoriesCost: result.unitAccessoriesCost,
        accessoriesDetail: result.accessoriesDetail,
        failureRateMode: result.failureRateMode,
        failureRateManual: result.failureRateManual,
        failureRateAuto: result.failureRateAuto,
        failureRateApplied: result.failureRateApplied,
        failureAutoSamples: result.failureAutoSamples,
        failureAutoWindow: result.failureAutoWindow,
        unitFailureBufferCost: result.unitFailureBufferCost,
        unitCostBeforeError: result.unitCostBeforeError,
        unitCostWithError: result.unitCostWithError,
        unitSalePrice: result.unitSalePrice,
        unitProfit: result.unitProfit,
        batchTotalCost: result.batchTotalCost,
        batchTotalSalePrice: result.batchTotalSalePrice,
        batchTotalProfit: result.batchTotalProfit,
        profitMargin: Number(job.profitMargin),
        discountPercent: job.discountPercent ? Number(job.discountPercent) : null,
        electricityRate: result.electricityRate,
        depreciationRatePerHour: result.depreciationRatePerHour,
        maintenanceRatePerHour: result.maintenanceRatePerHour,
      },
    });

    // Atualizar preço de venda do produto
    await this.prisma.product.update({
      where: { id: job.productId },
      data: { sellingPrice: result.unitSalePrice },
    });
    await this.ensureMissingChannelPrices(job.productId, result.unitSalePrice);

    return snapshot;
  }

  private async consumeAccessories(job: Awaited<ReturnType<ProductionService['findOne']>>) {
    const accessories = job.jobAccessories as Array<{
      accessory_id: string;
      qty_per_unit: number;
    }>;

    if (!accessories.length) return [];

    const accessoryIds = [...new Set(accessories.map((acc) => acc.accessory_id))];
    const existingConsumptions = await this.prisma.accessoryTransaction.findMany({
      where: {
        referenceId: job.id,
        referenceType: 'ProductionJob',
        type: 'CONSUMPTION',
        accessoryId: { in: accessoryIds },
      },
      select: { accessoryId: true },
    });
    const consumedAccessoryIds = new Set(existingConsumptions.map((tx) => tx.accessoryId));

    const alertResults = [];
    for (const acc of accessories) {
      if (consumedAccessoryIds.has(acc.accessory_id)) continue;

      const totalQty = acc.qty_per_unit * job.quantityOrdered;
      await this.prisma.$transaction([
        this.prisma.accessoryTransaction.create({
          data: {
            accessoryId: acc.accessory_id,
            type: 'CONSUMPTION',
            quantity: -totalQty,
            referenceId: job.id,
            referenceType: 'ProductionJob',
          },
        }),
        this.prisma.accessory.update({
          where: { id: acc.accessory_id },
          data: { stockQuantity: { decrement: totalQty } },
        }),
      ]);
      consumedAccessoryIds.add(acc.accessory_id);
      // Regra 8: verificar alerta de estoque após consumo
      const alert = await this.alerts.checkAccessoryStockAlert(acc.accessory_id);
      if (alert) alertResults.push(alert);
    }
    return alertResults;
  }

  private async hasConsumedMaterial(jobId: string): Promise<boolean> {
    const count = await this.prisma.materialStockTransaction.count({
      where: {
        referenceId: jobId,
        referenceType: 'ProductionJob',
        type: 'CONSUMPTION',
      },
    });
    return count > 0;
  }

  private async consumeMaterial(job: Awaited<ReturnType<ProductionService['findOne']>>) {
    // Consume from all jobMaterials, or fallback to legacy single material
    const materialsToConsume = job.jobMaterials?.length
      ? job.jobMaterials.map((jm) => ({
          stockId: jm.materialStockId,
          totalGrams: Number(jm.materialPerPrintG) * job.printsNeeded,
        }))
      : job.materialStockId
        ? [{ stockId: job.materialStockId, totalGrams: Number(job.materialPerPrintG) * job.printsNeeded }]
        : [];

    if (!materialsToConsume.length) return null;

    const stockIds = [...new Set(materialsToConsume.map((m) => m.stockId))];
    const existingConsumptions = await this.prisma.materialStockTransaction.findMany({
      where: {
        referenceId: job.id,
        referenceType: 'ProductionJob',
        type: 'CONSUMPTION',
        materialStockId: { in: stockIds },
      },
      select: { materialStockId: true },
    });
    const consumedStockIds = new Set(existingConsumptions.map((tx) => tx.materialStockId));

    const alerts: unknown[] = [];
    for (const { stockId, totalGrams } of materialsToConsume) {
      if (consumedStockIds.has(stockId)) continue;

      const stock = await this.prisma.materialStock.findUnique({ where: { id: stockId } });
      const statusUpdate = stock?.status === 'SEALED'
        ? { status: 'IN_USE' as const, openedDate: new Date() }
        : {};

      await this.prisma.$transaction([
        this.prisma.materialStockTransaction.create({
          data: {
            materialStockId: stockId,
            type: 'CONSUMPTION',
            quantityG: -totalGrams,
            referenceId: job.id,
            referenceType: 'ProductionJob',
          },
        }),
        this.prisma.materialStock.update({
          where: { id: stockId },
          data: {
            currentWeightG: { decrement: Math.round(totalGrams) },
            ...statusUpdate,
          },
        }),
      ]);
      consumedStockIds.add(stockId);
      const alert = await this.alerts.checkMaterialStockAlert(stockId);
      if (alert) alerts.push(alert);
    }
    return alerts.length ? alerts : null;
  }

  private async generateJobNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.productionJob.count({
      where: { jobNumber: { startsWith: `JOB-${year}` } },
    });
    const seq = String(count + 1).padStart(4, '0');
    return `JOB-${year}-${seq}`;
  }

  // ─────────────────────────────────────────
  // QUEUE / TIMELINE (NEXLAYER Production page)
  // ─────────────────────────────────────────

  /**
   * Returns equipment with their assigned active jobs ordered by queue position.
   * Unassigned active jobs are returned in a separate `unassigned` bucket.
   */
  async getQueue() {
    const [equipment, jobs] = await Promise.all([
      this.prisma.equipment.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          model: true,
          status: true,
          totalPrintHours: true,
          estimatedLifespanHours: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.productionJob.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        include: {
          customer: { select: { id: true, name: true } },
          product: {
            select: {
              id: true,
              name: true,
              channelPrices: {
                include: {
                  channel: {
                    select: {
                      id: true,
                      name: true,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
          equipment: { select: { id: true, name: true } },
          costSnapshots: {
            orderBy: { version: 'desc' },
            take: 1,
            select: { unitSalePrice: true, batchTotalSalePrice: true, unitCostWithError: true },
          },
        },
        orderBy: [
          { queuePosition: { sort: 'asc', nulls: 'last' } },
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
    ]);

    const byEquipment = new Map<string, typeof jobs>();
    const unassigned: typeof jobs = [];
    for (const job of jobs) {
      if (job.equipmentId) {
        const arr = byEquipment.get(job.equipmentId) ?? [];
        arr.push(job);
        byEquipment.set(job.equipmentId, arr);
      } else {
        unassigned.push(job);
      }
    }

    const lanes = equipment.map((eq) => ({
      equipment: eq,
      jobs: byEquipment.get(eq.id) ?? [],
    }));

    return { lanes, unassigned };
  }

  /**
   * Returns a flat timeline of jobs scheduled per equipment within a window.
   * - Running job (PRINTING): start = startedAt, end = startedAt + estimated minutes
   * - Queued: chained sequentially after the running job (or now), in queuePosition order
   */
  async getTimeline(opts: { from?: Date; to?: Date }) {
    const from = opts.from ?? new Date();
    const to = opts.to ?? new Date(from.getTime() + 48 * 60 * 60 * 1000);

    const equipment = await this.prisma.equipment.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });

    const jobs = await this.prisma.productionJob.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        equipmentId: { not: null },
      },
      include: {
        product: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: [
        { queuePosition: { sort: 'asc', nulls: 'last' } },
        { priority: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const lanes = equipment.map((eq) => {
      const eqJobs = jobs.filter((j) => j.equipmentId === eq.id);
      let cursor = from.getTime();
      const blocks = eqJobs.map((j) => {
        const totalMin = j.printTimeMinutes * j.printsNeeded;
        const startMs = j.status === 'PRINTING' && j.startedAt
          ? j.startedAt.getTime()
          : Math.max(cursor, from.getTime());
        const endMs = startMs + totalMin * 60 * 1000;
        cursor = endMs;
        return {
          jobId: j.id,
          jobNumber: j.jobNumber,
          status: j.status,
          productName: j.product.name,
          customerName: j.customer?.name ?? null,
          start: new Date(startMs).toISOString(),
          end: new Date(endMs).toISOString(),
          minutes: totalMin,
        };
      });
      return { equipment: eq, blocks };
    });

    return {
      window: { from: from.toISOString(), to: to.toISOString() },
      lanes,
    };
  }

  /**
   * Reorder a job within its (or a new) equipment lane.
   * Renumbers other queue positions in the same equipment to keep them contiguous.
   */
  async updateQueuePosition(id: string, newEquipmentId: string | null, newPosition: number) {
    const job = await this.prisma.productionJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job não encontrado');
    if (!ACTIVE_STATUSES.includes(job.status)) {
      throw new BadRequestException('Apenas jobs ativos podem ser reordenados');
    }

    return this.prisma.$transaction(async (tx) => {
      // Fetch active jobs in target lane (excluding the moved job)
      const lane = await tx.productionJob.findMany({
        where: {
          equipmentId: newEquipmentId,
          status: { in: ACTIVE_STATUSES },
          id: { not: id },
        },
        orderBy: [
          { queuePosition: { sort: 'asc', nulls: 'last' } },
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
        select: { id: true },
      });

      const clampedPos = Math.max(0, Math.min(newPosition, lane.length));
      const reordered = [...lane];
      reordered.splice(clampedPos, 0, { id });

      // Renumber sequentially
      await Promise.all(
        reordered.map((j, idx) =>
          tx.productionJob.update({
            where: { id: j.id },
            data: {
              queuePosition: idx,
              ...(j.id === id ? { equipmentId: newEquipmentId } : {}),
            },
          }),
        ),
      );

      return tx.productionJob.findUnique({
        where: { id },
        include: {
          equipment: { select: { id: true, name: true } },
        },
      });
    });
  }

  private async ensureMissingChannelPrices(productId: string, baseSalePrice: number) {
    const [channels, existing] = await Promise.all([
      this.prisma.salesChannel.findMany({
        select: { id: true, commissionPercent: true, feeFixed: true, feePercentVariable: true },
      }),
      this.prisma.productChannelPrice.findMany({
        where: { productId },
        select: { channelId: true },
      }),
    ]);

    if (!channels.length) return;

    const existingByChannel = new Set(existing.map((item) => item.channelId));
    const missing = channels
      .filter((channel) => !existingByChannel.has(channel.id))
      .map((channel) => ({
        productId,
        channelId: channel.id,
        price: this.calculateChannelPrice(baseSalePrice, channel),
      }));

    if (missing.length) {
      await this.prisma.productChannelPrice.createMany({
        data: missing,
        skipDuplicates: true,
      });
    }
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
