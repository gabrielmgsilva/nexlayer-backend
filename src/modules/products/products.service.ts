import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, Inject,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariationDto } from './dto/create-variation.dto';
import { UpdateVariationDto } from './dto/update-variation.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { paginate, getPrismaPage } from '../../shared/utils/paginate';
import { STORAGE_SERVICE, IStorageService } from '../../shared/storage/storage.interface';
import { AlertsService } from '../../shared/alerts/alerts.service';

const KIT_ITEM_PRODUCT_SELECT = {
  id: true,
  name: true,
  isKit: true,
  estimatedPrintTimeMinutes: true,
  estimatedMaterialG: true,
  piecesPerPrint: true,
  defaultAccessories: true,
  recommendedFilamentTypeId: true,
} as const;

const KIT_ITEMS_INCLUDE = {
  orderBy: { sortOrder: Prisma.SortOrder.asc },
  include: { product: { select: KIT_ITEM_PRODUCT_SELECT } },
} as const;

const CHANNEL_PRICE_INCLUDE = {
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
} as const;

function productInclude(withVariations = true) {
  return {
    category: { select: { id: true, name: true, slug: true } },
    recommendedFilamentType: { select: { id: true, name: true } },
    kitItems: KIT_ITEMS_INCLUDE,
    channelPrices: CHANNEL_PRICE_INCLUDE,
    ...(withVariations
      ? {
          variations: {
            where: { isActive: true },
            orderBy: [{ sortOrder: Prisma.SortOrder.asc }, { name: Prisma.SortOrder.asc }],
            include: { color: { select: { id: true, name: true, hexCode: true } } },
          },
        }
      : {}),
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  // ── Products CRUD ─────────────────────────────────────────────────────────

  async findAll(pagination: PaginationDto, categoryId?: string, isActive?: boolean) {
    const { page = 1, limit = 20 } = pagination;
    const where = {
      deletedAt: null as null,
      ...(categoryId ? { categoryId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variations: {
            where: { isActive: true },
            orderBy: [{ sortOrder: Prisma.SortOrder.asc }, { name: Prisma.SortOrder.asc }],
            include: { color: { select: { id: true, name: true, hexCode: true } } },
          },
          kitItems: KIT_ITEMS_INCLUDE,
          channelPrices: CHANNEL_PRICE_INCLUDE,
          _count: { select: { variations: true } },
        },
        orderBy: { name: 'asc' },
        ...getPrismaPage(page, limit),
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...productInclude(),
        _count: { select: { productionJobs: true, variations: true } },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async create(dto: CreateProductDto) {
    if (dto.sku) {
      const exists = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (exists) throw new ConflictException('SKU já em uso');
    }

    const { defaultAccessories, kitItems, channelPrices, ...rest } = dto;

    if (dto.isKit && kitItems?.length) {
      await this.validateKitItems(kitItems.map((i) => i.productId), null);
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...rest,
          estimatedPrintTimeMinutes: rest.estimatedPrintTimeMinutes ?? 0,
          estimatedMaterialG: rest.estimatedMaterialG ?? 0,
          piecesPerPrint: rest.piecesPerPrint ?? 1,
          defaultAccessories: defaultAccessories
            ? defaultAccessories.map((a) => ({ accessory_id: a.accessoryId, qty_per_unit: a.qtyPerUnit }))
            : [],
          ...(kitItems?.length
            ? {
                kitItems: {
                  create: kitItems.map((item, idx) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    sortOrder: item.sortOrder ?? idx,
                  })),
                },
              }
            : {}),
        },
      });

      const baseSalePrice = await this.resolveBaseSalePrice(
        tx,
        created.id,
        created.sellingPrice != null ? Number(created.sellingPrice) : null,
      );
      await this.replaceProductChannelPrices(tx, created.id, channelPrices, baseSalePrice);

      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: productInclude(),
      });
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    if (dto.sku) {
      const exists = await this.prisma.product.findFirst({ where: { sku: dto.sku, id: { not: id } } });
      if (exists) throw new ConflictException('SKU já em uso');
    }

    const { defaultAccessories, kitItems, channelPrices, ...rest } = dto;

    if (kitItems !== undefined) {
      await this.validateKitItems(kitItems.map((i) => i.productId), id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (kitItems !== undefined) {
        await tx.productKitItem.deleteMany({ where: { kitId: id } });
        if (kitItems.length) {
          await tx.productKitItem.createMany({
            data: kitItems.map((item, idx) => ({
              kitId: id,
              productId: item.productId,
              quantity: item.quantity,
              sortOrder: item.sortOrder ?? idx,
            })),
          });
        }
      }

      await tx.product.update({
        where: { id },
        data: {
          ...rest,
          ...(defaultAccessories !== undefined
            ? { defaultAccessories: defaultAccessories.map((a) => ({ accessory_id: a.accessoryId, qty_per_unit: a.qtyPerUnit })) }
            : {}),
        },
      });

      const refreshed = await tx.product.findUniqueOrThrow({ where: { id } });
      const baseSalePrice = await this.resolveBaseSalePrice(
        tx,
        id,
        refreshed.sellingPrice != null ? Number(refreshed.sellingPrice) : null,
      );

      if (channelPrices !== undefined) {
        await this.replaceProductChannelPrices(tx, id, channelPrices, baseSalePrice);
      } else {
        await this.ensureMissingChannelPrices(tx, id, baseSalePrice);
      }

      return tx.product.findUniqueOrThrow({
        where: { id },
        include: productInclude(),
      });
    });

    if (dto.stockQuantity !== undefined) {
      await this.alerts.checkProductStockAlert(id);
    }
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    const activeJobs = await this.prisma.productionJob.count({
      where: { productId: id, status: { notIn: ['DELIVERED', 'CANCELLED', 'QC_REJECTED'] } },
    });
    if (activeJobs > 0) {
      throw new BadRequestException(
        `Produto está em uso em ${activeJobs} job(s) ativo(s). Finalize-os antes de remover.`,
      );
    }
    // Prevent removing a product that is a component of an active kit
    const usedInKit = await this.prisma.productKitItem.count({ where: { productId: id } });
    if (usedInKit > 0) {
      throw new BadRequestException(
        `Produto é componente de ${usedInKit} kit(s). Remova-o dos kits antes de excluir.`,
      );
    }
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Kit validation ────────────────────────────────────────────────────────

  private async validateKitItems(productIds: string[], kitId: string | null) {
    const components = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      select: { id: true, isKit: true, name: true },
    });

    if (components.length !== productIds.length) {
      throw new BadRequestException('Um ou mais produtos do kit não foram encontrados.');
    }
    for (const c of components) {
      if (c.isKit) {
        throw new BadRequestException(`"${c.name}" é um kit e não pode ser componente de outro kit.`);
      }
      if (kitId && c.id === kitId) {
        throw new BadRequestException('Um kit não pode conter a si mesmo como componente.');
      }
    }
  }

  private async resolveBaseSalePrice(
    tx: Prisma.TransactionClient,
    productId: string,
    candidatePrice: number | null,
  ): Promise<number> {
    if (candidatePrice != null && Number.isFinite(candidatePrice) && candidatePrice >= 0) {
      return this.roundCurrency(candidatePrice);
    }

    const latestSnapshot = await tx.costSnapshot.findFirst({
      where: { productionJob: { productId } },
      orderBy: { generatedAt: 'desc' },
      select: { unitSalePrice: true },
    });
    if (!latestSnapshot) return 0;
    return this.roundCurrency(Number(latestSnapshot.unitSalePrice));
  }

  private async replaceProductChannelPrices(
    tx: Prisma.TransactionClient,
    productId: string,
    channelPrices: CreateProductDto['channelPrices'] | undefined,
    baseSalePrice: number,
  ) {
    const channels = await tx.salesChannel.findMany({
      select: { id: true, commissionPercent: true, feeFixed: true, feePercentVariable: true },
    });

    await tx.productChannelPrice.deleteMany({ where: { productId } });
    if (!channels.length) return;

    const provided = this.normalizeChannelPrices(channelPrices);
    const data = channels.map((channel) => ({
      productId,
      channelId: channel.id,
      price: provided.get(channel.id) ?? this.calculateChannelPrice(baseSalePrice, channel),
    }));

    await tx.productChannelPrice.createMany({ data });
  }

  private async ensureMissingChannelPrices(
    tx: Prisma.TransactionClient,
    productId: string,
    baseSalePrice: number,
  ) {
    const [channels, existing] = await Promise.all([
      tx.salesChannel.findMany({
        select: { id: true, commissionPercent: true, feeFixed: true, feePercentVariable: true },
      }),
      tx.productChannelPrice.findMany({
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
      await tx.productChannelPrice.createMany({ data: missing });
    }
  }

  private normalizeChannelPrices(channelPrices: CreateProductDto['channelPrices'] | undefined) {
    const normalized = new Map<string, number>();
    for (const item of channelPrices ?? []) {
      if (!item.channelId) continue;
      normalized.set(item.channelId, this.roundCurrency(Math.max(0, Number(item.price) || 0)));
    }
    return normalized;
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

  // ── Cost snapshot (latest per product) ────────────────────────────────────

  async getLatestCostSnapshot(productId: string) {
    await this.findOne(productId);
    return this.prisma.costSnapshot.findFirst({
      where: { productionJob: { productId } },
      orderBy: { generatedAt: 'desc' },
    });
  }

  // ── Product photo/model upload ────────────────────────────────────────────

  async uploadProductPhoto(productId: string, file: Express.Multer.File, isPrimary: boolean) {
    await this.findOne(productId);
    const result = await this.storage.upload(file, `products/${productId}/photos`);
    return this.addPhoto(productId, result.url, isPrimary);
  }

  async uploadProductModel(productId: string, file: Express.Multer.File) {
    await this.findOne(productId);
    const result = await this.storage.upload(file, `products/${productId}/models`);
    const ext = result.originalName.split('.').pop()?.toLowerCase() ?? 'stl';
    return this.addPrintFile(productId, {
      url: result.url,
      filename: result.originalName,
      format: ext,
      key: result.key,
    });
  }

  async addPhoto(productId: string, url: string, isPrimary: boolean) {
    const product = await this.findOne(productId);
    const photos = product.photos as Array<{ url: string; is_primary: boolean; sort_order: number }>;
    const newPhotos = [
      ...photos.map((p) => ({ ...p, is_primary: isPrimary ? false : p.is_primary })),
      { url, is_primary: isPrimary || photos.length === 0, sort_order: photos.length },
    ];
    return this.prisma.product.update({ where: { id: productId }, data: { photos: newPhotos } });
  }

  async removePhoto(productId: string, photoUrl: string) {
    const product = await this.findOne(productId);
    const photos = product.photos as Array<{ url: string; is_primary: boolean; sort_order: number }>;
    const filtered = photos.filter((p) => p.url !== photoUrl);
    if (filtered.length > 0 && !filtered.some((p) => p.is_primary)) filtered[0].is_primary = true;
    return this.prisma.product.update({ where: { id: productId }, data: { photos: filtered } });
  }

  async addPrintFile(productId: string, file: { url: string; filename: string; format: string; key?: string }) {
    const product = await this.findOne(productId);
    const printFiles = product.printFiles as Array<object>;
    return this.prisma.product.update({
      where: { id: productId },
      data: { printFiles: [...printFiles, { ...file, uploaded_at: new Date().toISOString() }] },
    });
  }

  async getPrintFileViewContent(productId: string, fileUrl: string) {
    const product = await this.findOne(productId);
    const printFiles = product.printFiles as Array<{ url: string; filename?: string; format?: string }>;

    const match = printFiles.find((f) => f.url === fileUrl);
    if (!match) {
      throw new NotFoundException('Arquivo de impressão não encontrado para este produto');
    }

    const upstream = await fetch(match.url);
    if (!upstream.ok) {
      throw new BadRequestException(`Falha ao obter arquivo externo (HTTP ${upstream.status})`);
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = (match.format ?? path.extname(match.url).replace('.', '')).toLowerCase();
    const upstreamType = upstream.headers.get('content-type');
    const contentType = this.resolvePrintFileContentType(ext, upstreamType);

    return {
      buffer,
      filename: match.filename ?? `modelo.${ext || 'bin'}`,
      contentType,
    };
  }

  private resolvePrintFileContentType(ext: string, upstreamType: string | null) {
    if (upstreamType && upstreamType !== 'application/octet-stream') {
      return upstreamType;
    }

    if (ext === '3mf') return 'model/3mf';
    if (ext === 'slt' || ext === 'stl') return 'model/stl';
    return 'application/octet-stream';
  }

  async removePrintFile(productId: string, fileUrl: string) {
    const product = await this.findOne(productId);
    const printFiles = product.printFiles as Array<{ url: string }>;
    return this.prisma.product.update({
      where: { id: productId },
      data: { printFiles: printFiles.filter((f) => f.url !== fileUrl) },
    });
  }

  // ── Stock management ──────────────────────────────────────────────────────

  async adjustStock(productId: string, delta: number) {
    await this.findOne(productId);
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: delta } },
    });
    await this.alerts.checkProductStockAlert(productId);
    return updated;
  }

  async adjustVariationStock(variationId: string, delta: number) {
    const variation = await this.prisma.productVariation.findUnique({ where: { id: variationId } });
    if (!variation) throw new NotFoundException('Variação não encontrada');
    const updated = await this.prisma.productVariation.update({
      where: { id: variationId },
      data: { stockQuantity: { increment: delta } },
    });
    await this.alerts.checkVariationStockAlert(variationId);
    return updated;
  }

  // ── Variations CRUD ───────────────────────────────────────────────────────

  async getVariations(productId: string) {
    await this.findOne(productId);
    return this.prisma.productVariation.findMany({
      where: { productId },
      include: { color: { select: { id: true, name: true, hexCode: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createVariation(productId: string, dto: CreateVariationDto) {
    await this.findOne(productId);
    if (dto.sku) {
      const exists = await this.prisma.productVariation.findUnique({ where: { sku: dto.sku } });
      if (exists) throw new ConflictException('SKU de variação já em uso');
    }
    return this.prisma.productVariation.create({
      data: { ...dto, productId },
      include: { color: { select: { id: true, name: true, hexCode: true } } },
    });
  }

  async updateVariation(productId: string, variationId: string, dto: UpdateVariationDto) {
    const variation = await this.prisma.productVariation.findFirst({
      where: { id: variationId, productId },
    });
    if (!variation) throw new NotFoundException('Variação não encontrada');
    if (dto.sku && dto.sku !== variation.sku) {
      const exists = await this.prisma.productVariation.findFirst({
        where: { sku: dto.sku, id: { not: variationId } },
      });
      if (exists) throw new ConflictException('SKU de variação já em uso');
    }
    const updated = await this.prisma.productVariation.update({
      where: { id: variationId },
      data: dto,
      include: { color: { select: { id: true, name: true, hexCode: true } } },
    });
    if (dto.stockQuantity !== undefined) {
      await this.alerts.checkVariationStockAlert(variationId);
    }
    return updated;
  }

  async removeVariation(productId: string, variationId: string) {
    const variation = await this.prisma.productVariation.findFirst({
      where: { id: variationId, productId },
    });
    if (!variation) throw new NotFoundException('Variação não encontrada');
    if (variation.photoKey) await this.storage.delete(variation.photoKey).catch(() => null);
    if (variation.modelFileKey) await this.storage.delete(variation.modelFileKey).catch(() => null);
    return this.prisma.productVariation.delete({ where: { id: variationId } });
  }

  async uploadVariationPhoto(productId: string, variationId: string, file: Express.Multer.File) {
    const variation = await this.prisma.productVariation.findFirst({
      where: { id: variationId, productId },
    });
    if (!variation) throw new NotFoundException('Variação não encontrada');
    if (variation.photoKey) await this.storage.delete(variation.photoKey).catch(() => null);
    const result = await this.storage.upload(file, `products/${productId}/variations/${variationId}/photos`);
    return this.prisma.productVariation.update({
      where: { id: variationId },
      data: { photoKey: result.key, photoUrl: result.url },
      include: { color: { select: { id: true, name: true, hexCode: true } } },
    });
  }

  async uploadVariationModel(productId: string, variationId: string, file: Express.Multer.File) {
    const variation = await this.prisma.productVariation.findFirst({
      where: { id: variationId, productId },
    });
    if (!variation) throw new NotFoundException('Variação não encontrada');
    if (variation.modelFileKey) await this.storage.delete(variation.modelFileKey).catch(() => null);
    const result = await this.storage.upload(file, `products/${productId}/variations/${variationId}/models`);
    const ext = result.originalName.split('.').pop()?.toLowerCase() ?? 'stl';
    return this.prisma.productVariation.update({
      where: { id: variationId },
      data: { modelFileKey: result.key, modelFileUrl: result.url, modelFormat: ext },
      include: { color: { select: { id: true, name: true, hexCode: true } } },
    });
  }
}
