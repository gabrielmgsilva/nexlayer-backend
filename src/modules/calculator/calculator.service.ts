import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CostEngineService } from '../production/cost-engine.service';
import { ProductionService } from '../production/production.service';
import { CreateJobDto } from '../production/dto/create-job.dto';
import { EstimateDto } from './dto/estimate.dto';

@Injectable()
export class CalculatorService {
  constructor(
    private prisma: PrismaService,
    private costEngine: CostEngineService,
    private productionService: ProductionService,
  ) {}

  async estimate(dto: EstimateDto) {
    // Normalize: support legacy single material or new array
    const materialInputs = dto.materials?.length
      ? dto.materials
      : dto.materialStockId && dto.materialGrams
        ? [{ materialStockId: dto.materialStockId, materialGrams: dto.materialGrams }]
        : [];

    const stocks = await Promise.all(
      materialInputs.map((m) =>
        this.prisma.materialStock.findUnique({
          where: { id: m.materialStockId },
          include: { material: { include: { brand: { select: { name: true } }, filamentType: { select: { name: true } } } } },
        }),
      ),
    );
    if (stocks.some((s) => !s)) throw new NotFoundException('Carretel não encontrado');

    const accessories = await Promise.all(
      (dto.accessories ?? []).map(async (a) => {
        const acc = await this.prisma.accessory.findUnique({ where: { id: a.accessoryId } });
        return {
          accessory_id: a.accessoryId,
          qty_per_unit: a.qtyPerUnit,
          unit_cost_at_time: acc ? Number(acc.costPerUnit) : 0,
        };
      }),
    );

    const result = await this.costEngine.calculate({
      equipmentId: dto.equipmentId,
      materials: stocks.map((s, i) => ({
        materialId: s!.materialId,
        materialPerPrintG: materialInputs[i].materialGrams,
      })),
      printTimeMinutes: dto.printTimeMinutes,
      piecesPerPrint: dto.piecesPerPrint,
      printsNeeded: dto.printsNeeded,
      quantityOrdered: dto.quantityOrdered,
      totalPiecesProduced: dto.totalQuantity,
      jobAccessories: accessories,
      costConfigId: dto.costConfigId,
      profitMargin: dto.profitMargin,
      discountPercent: dto.discountPercent,
      productionMode: dto.piecesPerPrint === 1 ? 'SINGLE_PIECE' : 'BATCH',
    });

    return {
      materials: stocks.map((s) => ({
        name: [s!.material.brand?.name, s!.material.filamentType?.name].filter(Boolean).join(' ') || s!.material.materialType,
      })),
      ...result,
    };
  }

  async createJob(dto: CreateJobDto) {
    return this.productionService.create(dto);
  }
}
