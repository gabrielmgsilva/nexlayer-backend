import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopeeClientService } from './shopee-client.service';

@Injectable()
export class ShopeeProductsService {
  private readonly logger = new Logger(ShopeeProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopeeClient: ShopeeClientService,
  ) {}

  /**
   * Get Shopee category tree for product listing
   */
  async getCategories(language = 'pt') {
    const response = await this.shopeeClient.request<{
      response: { category_list: unknown[] };
    }>({
      path: '/api/v2/product/get_category',
      query: { language },
    });
    return response.response.category_list;
  }

  /**
   * Publish a local product to Shopee
   */
  async publishProduct(productId: string, shopeeCategoryId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variations: true, category: true },
    });

    if (!product) throw new NotFoundException('Produto não encontrado');

    // Check if already published
    const existing = await this.prisma.shopeeProductMapping.findUnique({
      where: { productId },
    });
    if (existing) {
      throw new Error(`Produto já publicado no Shopee (item_id: ${existing.shopeeItemId})`);
    }

    const itemData: Record<string, unknown> = {
      original_price: Number(product.sellingPrice ?? 0),
      description: product.description || product.name,
      item_name: product.name.substring(0, 120), // Shopee limit
      normal_stock: product.stockQuantity,
      category_id: shopeeCategoryId,
      image: { image_id_list: [] }, // placeholder - images need separate upload
      logistic_info: await this.getLogisticsChannels(),
      weight: Number(product.weightG ?? 0) / 1000, // g → kg
      item_status: 'NORMAL',
    };

    if (product.sku) {
      itemData.item_sku = product.sku;
    }

    // Dimensions if available
    if (product.widthMm || product.heightMm || product.depthMm) {
      itemData.dimension = {
        package_width: Math.ceil((product.widthMm ?? 0) / 10), // mm → cm
        package_height: Math.ceil((product.heightMm ?? 0) / 10),
        package_length: Math.ceil((product.depthMm ?? 0) / 10),
      };
    }

    const response = await this.shopeeClient.request<{
      response: { item_id: number };
    }>({
      path: '/api/v2/product/add_item',
      method: 'POST',
      body: itemData,
    });

    const shopeeItemId = response.response.item_id;

    // Create mapping
    await this.prisma.shopeeProductMapping.create({
      data: {
        productId,
        shopeeItemId: BigInt(shopeeItemId),
        shopeeCategoryId: BigInt(shopeeCategoryId),
        shopeeStatus: 'NORMAL',
        lastSyncedAt: new Date(),
      },
    });

    // Update product with shopeeItemId
    await this.prisma.product.update({
      where: { id: productId },
      data: { shopeeItemId: BigInt(shopeeItemId) },
    });

    this.logger.log(`Published product ${product.name} to Shopee → item_id ${shopeeItemId}`);

    return { productId, shopeeItemId, name: product.name };
  }

  /**
   * Push current stock to Shopee for a single product
   */
  async syncStock(productId: string) {
    const mapping = await this.prisma.shopeeProductMapping.findUnique({
      where: { productId },
      include: { product: true },
    });

    if (!mapping) throw new NotFoundException('Produto não está publicado no Shopee');

    const stock = mapping.product.stockQuantity;

    await this.shopeeClient.request({
      path: '/api/v2/product/update_stock',
      method: 'POST',
      body: {
        item_id: Number(mapping.shopeeItemId),
        stock_list: [
          {
            model_id: mapping.shopeeModelId ? Number(mapping.shopeeModelId) : 0,
            normal_stock: stock,
          },
        ],
      },
    });

    await this.prisma.shopeeProductMapping.update({
      where: { id: mapping.id },
      data: { lastSyncedAt: new Date() },
    });

    this.logger.log(`Synced stock for product ${productId}: ${stock} units`);
    return { productId, stock };
  }

  /**
   * Push stock for all published products
   */
  async syncAllStock() {
    const mappings = await this.prisma.shopeeProductMapping.findMany({
      include: { product: { select: { id: true, stockQuantity: true, name: true } } },
    });

    let synced = 0;
    let errors = 0;

    for (const mapping of mappings) {
      try {
        await this.syncStock(mapping.productId);
        synced++;
      } catch (err) {
        this.logger.error(`Failed to sync stock for ${mapping.product.name}`, err);
        errors++;
      }
    }

    return { synced, errors, total: mappings.length };
  }

  /**
   * Update product info on Shopee
   */
  async updateProduct(productId: string) {
    const mapping = await this.prisma.shopeeProductMapping.findUnique({
      where: { productId },
      include: { product: true },
    });

    if (!mapping) throw new NotFoundException('Produto não está publicado no Shopee');

    const product = mapping.product;

    await this.shopeeClient.request({
      path: '/api/v2/product/update_item',
      method: 'POST',
      body: {
        item_id: Number(mapping.shopeeItemId),
        description: product.description || product.name,
        item_name: product.name.substring(0, 120),
        item_sku: product.sku || undefined,
        weight: Number(product.weightG ?? 0) / 1000,
      },
    });

    await this.prisma.shopeeProductMapping.update({
      where: { id: mapping.id },
      data: { lastSyncedAt: new Date() },
    });

    return { productId, shopeeItemId: Number(mapping.shopeeItemId) };
  }

  /**
   * Unlink / delist a product from Shopee
   */
  async unpublishProduct(productId: string) {
    const mapping = await this.prisma.shopeeProductMapping.findUnique({
      where: { productId },
    });

    if (!mapping) throw new NotFoundException('Produto não está publicado no Shopee');

    // Delist on Shopee
    await this.shopeeClient.request({
      path: '/api/v2/product/update_item',
      method: 'POST',
      body: {
        item_id: Number(mapping.shopeeItemId),
        item_status: 'DELETED',
      },
    });

    // Remove local mapping
    await this.prisma.shopeeProductMapping.delete({ where: { id: mapping.id } });
    await this.prisma.product.update({
      where: { id: productId },
      data: { shopeeItemId: null },
    });

    return { productId, removed: true };
  }

  /**
   * Get product mappings for display
   */
  async getProductMappings(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.shopeeProductMapping.findMany({
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stockQuantity: true,
              sellingPrice: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shopeeProductMapping.count(),
    ]);

    return {
      data: data.map((d) => ({
        ...d,
        shopeeItemId: Number(d.shopeeItemId),
        shopeeModelId: d.shopeeModelId ? Number(d.shopeeModelId) : null,
        shopeeCategoryId: d.shopeeCategoryId ? Number(d.shopeeCategoryId) : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get logistics channels for product listing
   */
  private async getLogisticsChannels() {
    try {
      const response = await this.shopeeClient.request<{
        response: { logistics_channel_list: { logistics_channel_id: number; enabled: boolean }[] };
      }>({
        path: '/api/v2/logistics/get_channel_list',
      });

      return response.response.logistics_channel_list
        .filter((ch) => ch.enabled)
        .map((ch) => ({
          logistic_id: ch.logistics_channel_id,
          enabled: true,
        }));
    } catch {
      return [];
    }
  }
}
