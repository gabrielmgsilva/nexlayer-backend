import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CostMaterialInput {
  materialId: string;
  materialPerPrintG: number;
}

export interface CostInput {
  equipmentId: string;
  /** @deprecated Use materials[] instead */
  materialId?: string;
  printTimeMinutes: number;
  /** @deprecated Use materials[] instead */
  materialPerPrintG?: number;
  materials?: CostMaterialInput[];
  piecesPerPrint: number;
  printsNeeded: number;
  quantityOrdered: number;
  totalPiecesProduced: number;
  jobAccessories: Array<{ accessory_id: string; qty_per_unit: number; unit_cost_at_time?: number }>;
  costConfigId: string;
  profitMargin: number;
  discountPercent?: number;
  productionMode: 'SINGLE_PIECE' | 'BATCH';
  batchStrategy?: 'FULL_PRINTS' | 'EXACT_QUANTITY';
}

export interface MaterialDetail {
  name: string;
  costPerKg: number;
  gramsPerPrint: number;
  gramsPerUnit: number;
  costPerPrint: number;
  costPerUnit: number;
}

export interface CostResult {
  // Por impressão
  printElectricityCost: number;
  printDepreciationCost: number;
  printMaintenanceCost: number;
  printMaterialCost: number;
  printTotalCost: number;

  // Por unidade
  unitElectricityCost: number;
  unitDepreciationCost: number;
  unitMaintenanceCost: number;
  unitLaborCost: number;
  unitOverheadCost: number;
  unitMaterialCost: number;
  unitAccessoriesCost: number;
  accessoriesDetail: Array<{ name: string; qty: number; unit_cost: number; subtotal: number }>;

  // Taxa de erro
  failureRateMode: string;
  failureRateManual: number;
  failureRateAuto: number | null;
  failureRateApplied: number;
  failureAutoSamples: number | null;
  failureAutoWindow: number | null;
  unitFailureBufferCost: number;

  // Totais
  unitCostBeforeError: number;
  unitCostWithError: number;
  unitSalePrice: number;
  unitProfit: number;
  batchTotalCost: number;
  batchTotalSalePrice: number;
  batchTotalProfit: number;

  // Snapshots de taxas
  electricityRate: number;
  depreciationRatePerHour: number;
  maintenanceRatePerHour: number;

  // Material snapshot
  materialName: string;
  materialCostPerKg: number;
  materialGramsPerPrint: number;
  materialGramsPerUnit: number;
  materialsDetail: MaterialDetail[];

  // Equipment snapshot
  equipmentName: string;
  equipmentPowerWatts: number;
}

@Injectable()
export class CostEngineService {
  constructor(private prisma: PrismaService) {}

  async calculate(input: CostInput): Promise<CostResult> {
    // Normalize materials: support legacy single material or new array
    const materialInputs: CostMaterialInput[] = input.materials?.length
      ? input.materials
      : input.materialId && input.materialPerPrintG
        ? [{ materialId: input.materialId, materialPerPrintG: input.materialPerPrintG }]
        : [];

    const [equipment, costConfig] = await Promise.all([
      this.prisma.equipment.findUnique({ where: { id: input.equipmentId } }),
      this.prisma.costConfig.findUnique({ where: { id: input.costConfigId } }),
    ]);

    const materialRecords = await Promise.all(
      materialInputs.map((m) =>
        this.prisma.material.findUnique({
          where: { id: m.materialId },
          include: { brand: { select: { name: true } }, filamentType: { select: { name: true } } },
          // failureRatePercent is included by default as it's a scalar field
        }),
      ),
    );

    // Fetch latest active stock per material to get costPerKg
    const materialCosts = await Promise.all(
      materialInputs.map((m) =>
        this.prisma.materialStock.findFirst({
          where: { materialId: m.materialId, status: { in: ['SEALED', 'IN_USE'] } },
          orderBy: { createdAt: 'desc' },
          select: { costPerKg: true },
        }),
      ),
    );

    if (!equipment || !costConfig || materialRecords.some((m) => !m)) {
      throw new Error('Equipamento, material ou configuração de custo não encontrados');
    }

    const printHours = input.printTimeMinutes / 60;
    const piecesPerPrint = input.piecesPerPrint;
    const kwh = Number(equipment.avgPowerWatts) / 1000;
    const electricityRate = Number(costConfig.electricityCostPerKwh);

    // ── Custos por impressão ─────────────────────────────────────
    const printElectricityCost = round4(kwh * printHours * electricityRate);

    const depreciationRatePerHour = round6(
      Number(equipment.purchasePrice) / equipment.estimatedLifespanHours,
    );
    const printDepreciationCost = round4(depreciationRatePerHour * printHours);

    const maintenanceRatePerHour = round6(
      Number(equipment.annualMaintenanceCost) / equipment.annualUsageHours,
    );
    const printMaintenanceCost = round4(maintenanceRatePerHour * printHours);

    // ── Custos de material (multi-material) ─────────────────────
    const materialsDetail: MaterialDetail[] = materialInputs.map((mi, idx) => {
      const mat = materialRecords[idx]!;
      const costPerKg = Number(materialCosts[idx]?.costPerKg ?? 0);
      const gramsPerPrint = mi.materialPerPrintG;
      const costPerPrint = round4((gramsPerPrint / 1000) * costPerKg);
      const gramsPerUnit = round4(gramsPerPrint / piecesPerPrint);
      const costPerUnit = round4(costPerPrint / piecesPerPrint);
      const name = [mat.brand?.name, mat.filamentType?.name].filter(Boolean).join(' ') || mat.materialType;
      return {
        name,
        costPerKg,
        gramsPerPrint,
        gramsPerUnit,
        costPerPrint,
        costPerUnit,
      };
    });

    const printMaterialCost = round4(materialsDetail.reduce((sum, m) => sum + m.costPerPrint, 0));

    // Aggregate material snapshot (sum of all materials)
    const materialCostPerKg = materialsDetail.length === 1 ? materialsDetail[0].costPerKg : 0;
    const materialGramsPerPrint = round4(materialsDetail.reduce((sum, m) => sum + m.gramsPerPrint, 0));
    const materialName = materialsDetail.map((m) => m.name).join(' + ');

    const printTotalCost = round4(
      printElectricityCost + printDepreciationCost + printMaintenanceCost + printMaterialCost,
    );

    // ── Custos por unidade (diluição) ───────────────────────────
    const unitElectricityCost = round4(printElectricityCost / piecesPerPrint);
    const unitDepreciationCost = round4(printDepreciationCost / piecesPerPrint);
    const unitMaintenanceCost = round4(printMaintenanceCost / piecesPerPrint);

    const materialGramsPerUnit = round4(materialGramsPerPrint / piecesPerPrint);
    const unitMaterialCost = round4(printMaterialCost / piecesPerPrint);

    // Mão de obra
    let unitLaborCost = 0;
    if (costConfig.laborCostPerHour && costConfig.laborMinutesPerJob) {
      const laborPerJob =
        (Number(costConfig.laborCostPerHour) / 60) * costConfig.laborMinutesPerJob;
      unitLaborCost = round4(laborPerJob / input.quantityOrdered);
    }

    // Overhead
    let unitOverheadCost = 0;
    if (costConfig.monthlyOverhead && costConfig.monthlyProductionHours) {
      const overheadPerHour =
        Number(costConfig.monthlyOverhead) / costConfig.monthlyProductionHours;
      const overheadPerPrint = overheadPerHour * printHours;
      unitOverheadCost = round4(overheadPerPrint / piecesPerPrint);
    }

    // ── Acessórios ───────────────────────────────────────────────
    let unitAccessoriesCost = 0;
    const accessoriesDetail: CostResult['accessoriesDetail'] = [];

    for (const jobAcc of input.jobAccessories) {
      let costPerUnit: number;
      if (jobAcc.unit_cost_at_time !== undefined) {
        costPerUnit = jobAcc.unit_cost_at_time;
      } else {
        const acc = await this.prisma.accessory.findUnique({
          where: { id: jobAcc.accessory_id },
        });
        costPerUnit = acc ? Number(acc.costPerUnit) : 0;
      }
      const subtotal = round4(jobAcc.qty_per_unit * costPerUnit);
      unitAccessoriesCost = round4(unitAccessoriesCost + subtotal);

      const acc = await this.prisma.accessory.findUnique({
        where: { id: jobAcc.accessory_id },
        select: { name: true },
      });
      accessoriesDetail.push({
        name: acc?.name ?? jobAcc.accessory_id,
        qty: jobAcc.qty_per_unit,
        unit_cost: costPerUnit,
        subtotal,
      });
    }

    // ── Taxa de erro (lida do material principal) ─────────────────
    // Usa a taxa do primeiro material (maior quantidade de material)
    const primaryMaterial = materialRecords[0];
    const failureRateMode = 'MANUAL';
    const failureRateManual = Number(primaryMaterial?.failureRatePercent ?? 5);
    const failureRateAuto: number | null = null;
    const failureAutoSamples: number | null = null;
    const failureAutoWindow: number | null = null;
    const failureRateApplied = failureRateManual;

    // ── Custo unitário base ──────────────────────────────────────
    const unitCostBeforeError = round4(
      unitElectricityCost +
        unitDepreciationCost +
        unitMaintenanceCost +
        unitLaborCost +
        unitOverheadCost +
        unitMaterialCost +
        unitAccessoriesCost,
    );

    const unitFailureBufferCost = round4(
      unitCostBeforeError * (failureRateApplied / 100),
    );
    const unitCostWithError = round4(unitCostBeforeError + unitFailureBufferCost);

    // ── Preço de venda ───────────────────────────────────────────
    const margin = input.profitMargin;
    let unitSalePrice = round2(unitCostWithError * (1 + margin));

    if (input.discountPercent) {
      unitSalePrice = round2(unitSalePrice * (1 - input.discountPercent / 100));
    }

    const unitProfit = round4(unitSalePrice - unitCostWithError);

    // ── Totais do lote ───────────────────────────────────────────
    const qty = input.quantityOrdered;
    const batchTotalCost = round2(unitCostWithError * qty);
    const batchTotalSalePrice = round2(unitSalePrice * qty);
    const batchTotalProfit = round2(unitProfit * qty);

    return {
      printElectricityCost,
      printDepreciationCost,
      printMaintenanceCost,
      printMaterialCost,
      printTotalCost,
      unitElectricityCost,
      unitDepreciationCost,
      unitMaintenanceCost,
      unitLaborCost,
      unitOverheadCost,
      unitMaterialCost,
      unitAccessoriesCost,
      accessoriesDetail,
      failureRateMode,
      failureRateManual,
      failureRateAuto,
      failureRateApplied,
      failureAutoSamples,
      failureAutoWindow,
      unitFailureBufferCost,
      unitCostBeforeError,
      unitCostWithError,
      unitSalePrice,
      unitProfit,
      batchTotalCost,
      batchTotalSalePrice,
      batchTotalProfit,
      electricityRate,
      depreciationRatePerHour,
      maintenanceRatePerHour,
      materialName: materialName,
      materialCostPerKg,
      materialGramsPerPrint,
      materialGramsPerUnit,
      materialsDetail,
      equipmentName: equipment.name,
      equipmentPowerWatts: equipment.avgPowerWatts,
    };
  }
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
function round6(n: number) { return Math.round(n * 1000000) / 1000000; }
