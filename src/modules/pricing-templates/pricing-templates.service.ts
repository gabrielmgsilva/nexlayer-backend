import {
  Injectable, NotFoundException, BadRequestException,
  Logger, InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePricingTemplateDto } from './dto/create-template.dto';
import { DeriveProductDto } from './dto/derive-product.dto';

function n(v: any): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function round2(v: number) { return Math.round(v * 100) / 100; }

@Injectable()
export class PricingTemplatesService {
  private readonly logger = new Logger(PricingTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Listar todos os templates ────────────────────────
  async findAll() {
    return this.prisma.pricingTemplate.findMany({
      include: {
        product: { select: { id: true, name: true, sku: true, categoryId: true, category: { select: { name: true } } } },
        _count:  { select: { derivedProducts: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ── Detalhe de um template ───────────────────────────
  async findOne(id: string) {
    const template = await this.prisma.pricingTemplate.findUnique({
      where: { id },
      include: {
        product:        { select: { id: true, name: true, sku: true } },
        derivedProducts: {
          where: { deletedAt: null },
          select: { id: true, name: true, sku: true, sellingPrice: true, estimatedMaterialG: true, estimatedPrintTimeMinutes: true, templateMargin: true, isActive: true },
        },
      },
    });
    if (!template) throw new NotFoundException('Template não encontrado');
    return template;
  }

  // ── Criar template a partir de um produto âncora ─────
  async create(dto: CreatePricingTemplateDto) {
    this.logger.log(`Criando template de precificação para produto ${dto.productId}`);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Produto âncora não encontrado');

    // Precisa de pelo menos um CostSnapshot para extrair as taxas
    const snapshot = await this.prisma.costSnapshot.findFirst({
      where: { productionJob: { productId: dto.productId } },
      orderBy: { generatedAt: 'desc' },
    });
    if (!snapshot) {
      throw new BadRequestException(
        'O produto âncora não possui nenhum cálculo de custo (CostSnapshot). ' +
        'Calcule este produto na calculadora antes de torná-lo um template.',
      );
    }

    // Extrair taxas fundamentais do snapshot
    const materialGramsPerUnit = n(snapshot.materialGramsPerUnit);
    const unitMaterialCost     = n(snapshot.unitMaterialCost);
    const rateMaterialPerG     = materialGramsPerUnit > 0
      ? unitMaterialCost / materialGramsPerUnit
      : 0;

    const printTimeMinutes     = n(snapshot.printTimeMinutes) / Math.max(1, n(snapshot.piecesPerPrint));
    const fixedCostPerUnit     = n(snapshot.unitElectricityCost) + n(snapshot.unitDepreciationCost) + n(snapshot.unitMaintenanceCost);
    const rateTimePerMin       = printTimeMinutes > 0 ? fixedCostPerUnit / printTimeMinutes : 0;

    const baseAccessoryCost    = n(snapshot.unitAccessoriesCost);
    const failureRateApplied   = n(snapshot.failureRateApplied);

    try {
      const template = await this.prisma.pricingTemplate.upsert({
        where: { productId: dto.productId },
        create: {
          productId:          dto.productId,
          snapshotId:         snapshot.id,
          name:               dto.name,
          rateMaterialPerG,
          rateTimePerMin,
          baseAccessoryCost,
          failureRateApplied,
          defaultMargin:      dto.defaultMargin ?? 0.4,
          notes:              dto.notes,
        },
        update: {
          snapshotId:         snapshot.id,
          name:               dto.name,
          rateMaterialPerG,
          rateTimePerMin,
          baseAccessoryCost,
          failureRateApplied,
          defaultMargin:      dto.defaultMargin ?? 0.4,
          notes:              dto.notes,
        },
      });

      this.logger.log(
        `Template criado: R$/g=${rateMaterialPerG.toFixed(6)}, R$/min=${rateTimePerMin.toFixed(6)}, ` +
        `acessórios=${baseAccessoryCost.toFixed(4)}, falha=${failureRateApplied}%`,
      );
      return template;
    } catch (err) {
      this.logger.error('Erro ao criar template', err);
      throw new InternalServerErrorException('Falha ao criar template de precificação');
    }
  }

  // ── Calcular preço de um produto derivado (preview) ──
  calculatePrice(template: { rateMaterialPerG: any; rateTimePerMin: any; baseAccessoryCost: any; failureRateApplied: any }, input: {
    estimatedMaterialG: number; estimatedPrintTimeMinutes: number; piecesPerPrint?: number; margin: number;
  }) {
    const pieces     = Math.max(1, input.piecesPerPrint ?? 1);
    const materialG  = input.estimatedMaterialG / pieces;
    const timePerMin = input.estimatedPrintTimeMinutes / pieces;

    const unitMaterialCost  = n(template.rateMaterialPerG)  * materialG;
    const unitTimeCost      = n(template.rateTimePerMin)     * timePerMin;
    const unitAccessoryCost = n(template.baseAccessoryCost);
    const unitCostBeforeErr = unitMaterialCost + unitTimeCost + unitAccessoryCost;

    const failureRate   = n(template.failureRateApplied) / 100;
    const unitCostWithErr = unitCostBeforeErr * (1 + failureRate);

    const margin        = Math.min(0.99, Math.max(0, input.margin));
    const sellingPrice  = margin < 1 ? unitCostWithErr / (1 - margin) : unitCostWithErr * 2;

    return {
      unitMaterialCost:  round2(unitMaterialCost),
      unitTimeCost:      round2(unitTimeCost),
      unitAccessoryCost: round2(unitAccessoryCost),
      unitCostBeforeErr: round2(unitCostBeforeErr),
      unitCostWithErr:   round2(unitCostWithErr),
      margin,
      sellingPrice:      round2(sellingPrice),
      grossProfit:       round2(sellingPrice - unitCostWithErr),
    };
  }

  // ── Preview de preço (sem criar produto) ─────────────
  async preview(templateId: string, dto: DeriveProductDto) {
    const template = await this.prisma.pricingTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template não encontrado');

    const margin = dto.margin ?? n(template.defaultMargin);
    return this.calculatePrice(template, {
      estimatedMaterialG:        dto.estimatedMaterialG,
      estimatedPrintTimeMinutes: dto.estimatedPrintTimeMinutes,
      piecesPerPrint:            dto.piecesPerPrint ?? 1,
      margin,
    });
  }

  // ── Derivar um produto a partir do template ───────────
  async deriveProduct(templateId: string, dto: DeriveProductDto) {
    const template = await this.prisma.pricingTemplate.findUnique({
      where: { id: templateId },
      include: { product: { select: { categoryId: true, recommendedFilamentTypeId: true } } },
    });
    if (!template) throw new NotFoundException('Template não encontrado');

    const margin = dto.margin ?? n(template.defaultMargin);
    const pricing = this.calculatePrice(template, {
      estimatedMaterialG:        dto.estimatedMaterialG,
      estimatedPrintTimeMinutes: dto.estimatedPrintTimeMinutes,
      piecesPerPrint:            dto.piecesPerPrint ?? 1,
      margin,
    });

    const categoryId = dto.categoryId ?? template.product.categoryId;
    if (!categoryId) throw new BadRequestException('Informe a categoria do produto derivado');

    try {
      const product = await this.prisma.product.create({
        data: {
          name:                       dto.name.trim(),
          sku:                        dto.sku?.trim() || undefined,
          description:                dto.description?.trim() || undefined,
          categoryId,
          estimatedPrintTimeMinutes:  dto.estimatedPrintTimeMinutes,
          estimatedMaterialG:         dto.estimatedMaterialG,
          piecesPerPrint:             dto.piecesPerPrint ?? 1,
          recommendedFilamentTypeId:  template.product.recommendedFilamentTypeId ?? undefined,
          sellingPrice:               pricing.sellingPrice,
          pricingTemplateId:          templateId,
          templateMargin:             margin,
          isActive:                   dto.isActive ?? true,
          defaultAccessories:         [],
          photos:                     [],
          printFiles:                 [],
          stockQuantity:              0,
        } as any,
      });

      this.logger.log(`Produto derivado criado: ${product.id} (${product.name}), preço R$${pricing.sellingPrice}`);
      return { product, pricing };
    } catch (err) {
      this.logger.error('Erro ao derivar produto', err);
      throw new InternalServerErrorException('Falha ao criar produto derivado');
    }
  }

  // ── Recalcular todos os produtos derivados em lote ────
  async recalculateAll(templateId: string) {
    const template = await this.prisma.pricingTemplate.findUnique({
      where: { id: templateId },
      include: {
        derivedProducts: {
          where: { deletedAt: null },
          select: { id: true, name: true, estimatedMaterialG: true, estimatedPrintTimeMinutes: true, piecesPerPrint: true, templateMargin: true, sellingPrice: true },
        },
      },
    });
    if (!template) throw new NotFoundException('Template não encontrado');

    const results: Array<{ productId: string; name: string; oldPrice: number; newPrice: number; delta: number }> = [];

    for (const p of template.derivedProducts) {
      const margin = n(p.templateMargin) || n(template.defaultMargin);
      const pricing = this.calculatePrice(template, {
        estimatedMaterialG:        n(p.estimatedMaterialG),
        estimatedPrintTimeMinutes: p.estimatedPrintTimeMinutes,
        piecesPerPrint:            p.piecesPerPrint,
        margin,
      });

      const oldPrice = n(p.sellingPrice);
      if (Math.abs(oldPrice - pricing.sellingPrice) >= 0.01) {
        await this.prisma.product.update({
          where: { id: p.id },
          data: { sellingPrice: pricing.sellingPrice },
        });
        results.push({ productId: p.id, name: p.name, oldPrice, newPrice: pricing.sellingPrice, delta: pricing.sellingPrice - oldPrice });
      }
    }

    this.logger.log(`Recálculo em lote: ${results.length} produtos atualizados de ${template.derivedProducts.length}`);
    return { updated: results.length, total: template.derivedProducts.length, changes: results };
  }

  // ── Remover template (não deleta os produtos derivados)
  async remove(id: string) {
    const template = await this.prisma.pricingTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template não encontrado');

    // Desvincula produtos derivados antes de deletar
    await this.prisma.product.updateMany({
      where: { pricingTemplateId: id },
      data: { pricingTemplateId: null, templateMargin: null },
    });

    await this.prisma.pricingTemplate.delete({ where: { id } });
    this.logger.log(`Template ${id} removido`);
  }
}
