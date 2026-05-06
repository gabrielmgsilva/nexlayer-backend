import { Injectable, Logger } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import { ShopeeClientService } from './shopee-client.service';

interface ShopeeOrderItem {
  item_id: number;
  item_name: string;
  model_id: number;
  model_quantity_purchased: number;
  model_discounted_price: number;
  model_original_price: number;
}

interface ShopeeOrderDetail {
  order_sn: string;
  order_status: string;
  create_time: number;
  update_time: number;
  buyer_username: string;
  recipient_address: {
    name: string;
    phone: string;
    full_address: string;
    city: string;
    state: string;
    zipcode: string;
  };
  item_list: ShopeeOrderItem[];
  estimated_shipping_fee: number;
  total_amount: number;
  shipping_carrier: string;
  tracking_no: string;
}

@Injectable()
export class ShopeeOrdersService {
  private readonly logger = new Logger(ShopeeOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopeeClient: ShopeeClientService,
    private readonly salesService: SalesService,
  ) {}

  /**
   * Fetch recent orders from Shopee and import new ones
   */
  async syncOrders(timeFrom?: number, timeTo?: number) {
    const now = Math.floor(Date.now() / 1000);
    const from = timeFrom ?? now - 7 * 24 * 3600; // last 7 days
    const to = timeTo ?? now;

    const orderList = await this.fetchOrderList(from, to);
    this.logger.log(`Found ${orderList.length} Shopee orders to process`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const orderSn of orderList) {
      try {
        const existing = await this.prisma.shopeeOrderMapping.findUnique({
          where: { shopeeOrderSn: orderSn },
        });
        if (existing) {
          await this.updateOrderStatus(existing.saleOrderId, orderSn);
          skipped++;
          continue;
        }

        await this.importOrder(orderSn);
        imported++;
      } catch (err) {
        this.logger.error(`Failed to process Shopee order ${orderSn}`, err);
        errors++;
      }
    }

    return { imported, skipped, errors, total: orderList.length };
  }

  /**
   * Fetch list of order SNs from Shopee
   */
  private async fetchOrderList(timeFrom: number, timeTo: number): Promise<string[]> {
    const allOrders: string[] = [];
    let cursor = '';
    let hasMore = true;

    while (hasMore) {
      const query: Record<string, string | number> = {
        time_range_field: 'create_time',
        time_from: timeFrom,
        time_to: timeTo,
        page_size: 50,
      };
      if (cursor) query.cursor = cursor;

      const response = await this.shopeeClient.request<{
        response: {
          order_list: { order_sn: string }[];
          more: boolean;
          next_cursor: string;
        };
      }>({
        path: '/api/v2/order/get_order_list',
        query,
      });

      const data = response.response;
      allOrders.push(...data.order_list.map((o) => o.order_sn));
      hasMore = data.more;
      cursor = data.next_cursor;
    }

    return allOrders;
  }

  /**
   * Fetch full order details from Shopee
   */
  private async fetchOrderDetail(orderSn: string): Promise<ShopeeOrderDetail> {
    const response = await this.shopeeClient.request<{
      response: { order_list: ShopeeOrderDetail[] };
    }>({
      path: '/api/v2/order/get_order_detail',
      query: {
        order_sn_list: orderSn,
        response_optional_fields:
          'buyer_username,recipient_address,item_list,estimated_shipping_fee,total_amount,shipping_carrier,tracking_no',
      },
    });
    return response.response.order_list[0];
  }

  /**
   * Import a single Shopee order into CriaForma as a SaleOrder
   */
  private async importOrder(orderSn: string) {
    const detail = await this.fetchOrderDetail(orderSn);

    // Ensure "Shopee" sales channel exists
    const channel = await this.ensureShopeeChannel();

    // Find or create customer from buyer info
    const customer = await this.findOrCreateCustomer(detail);

    // Map Shopee items to local products
    const saleItems = await this.mapOrderItems(detail.item_list);

    if (saleItems.length === 0) {
      this.logger.warn(`No mappable items for Shopee order ${orderSn}, skipping`);
      return;
    }

    // Create SaleOrder via SalesService.create then auto-confirm
    const order = await this.salesService.create({
      channelId: channel.id,
      customerId: customer?.id,
      shippingCost: detail.estimated_shipping_fee ?? 0,
      discount: 0,
      notes: `Shopee Order: ${orderSn}`,
      items: saleItems,
    });

    // Update with Shopee-specific fields
    await this.prisma.saleOrder.update({
      where: { id: order.id },
      data: {
        shopeeOrderSn: orderSn,
        trackingNumber: detail.tracking_no || null,
        shippingCarrier: detail.shipping_carrier || null,
      },
    });

    // Create mapping
    await this.prisma.shopeeOrderMapping.create({
      data: {
        shopeeOrderSn: orderSn,
        saleOrderId: order.id,
        shopeeStatus: detail.order_status,
        rawPayload: JSON.parse(JSON.stringify(detail)),
        lastSyncedAt: new Date(),
      },
    });

    // Auto-confirm if Shopee order is already paid/ready_to_ship
    const autoConfirmStatuses = ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED'];
    if (autoConfirmStatuses.includes(detail.order_status)) {
      await this.salesService.updateStatus(order.id, SaleStatus.CONFIRMED);
    }

    this.logger.log(`Imported Shopee order ${orderSn} → ${order.orderNumber}`);
  }

  /**
   * Update status of already-imported order from Shopee status changes
   */
  private async updateOrderStatus(saleOrderId: string, orderSn: string) {
    const detail = await this.fetchOrderDetail(orderSn);

    const mapping = await this.prisma.shopeeOrderMapping.findUnique({
      where: { shopeeOrderSn: orderSn },
    });

    if (mapping && mapping.shopeeStatus !== detail.order_status) {
      await this.prisma.shopeeOrderMapping.update({
        where: { id: mapping.id },
        data: {
          shopeeStatus: detail.order_status,
          rawPayload: JSON.parse(JSON.stringify(detail)),
          lastSyncedAt: new Date(),
        },
      });

      // Update tracking if available
      if (detail.tracking_no) {
        await this.prisma.saleOrder.update({
          where: { id: saleOrderId },
          data: {
            trackingNumber: detail.tracking_no,
            shippingCarrier: detail.shipping_carrier || null,
          },
        });
      }

      // Map Shopee status → CriaForma status
      const order = await this.prisma.saleOrder.findUnique({
        where: { id: saleOrderId },
        select: { status: true },
      });

      if (order) {
        const shopeeToLocalStatus: Record<string, SaleStatus> = {
          SHIPPED: SaleStatus.SHIPPED,
          COMPLETED: SaleStatus.DELIVERED,
          CANCELLED: SaleStatus.CANCELLED,
        };
        const newStatus = shopeeToLocalStatus[detail.order_status];
        if (newStatus && newStatus !== order.status) {
          try {
            await this.salesService.updateStatus(saleOrderId, newStatus);
          } catch (e) {
            this.logger.warn(`Could not transition order ${saleOrderId} to ${newStatus}: ${(e as Error).message}`);
          }
        }
      }
    }
  }

  private async ensureShopeeChannel() {
    let channel = await this.prisma.salesChannel.findFirst({
      where: { name: 'Shopee' },
    });
    if (!channel) {
      channel = await this.prisma.salesChannel.create({
        data: { name: 'Shopee', commissionPercent: 12 },
      });
    }
    return channel;
  }

  private async findOrCreateCustomer(detail: ShopeeOrderDetail) {
    const addr = detail.recipient_address;
    if (!addr?.name) return null;

    let customer = await this.prisma.customer.findFirst({
      where: { name: addr.name, phone: addr.phone || undefined },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          name: addr.name,
          phone: addr.phone || null,
          address: addr.full_address || null,
          city: addr.city || null,
          state: addr.state || null,
          zipCode: addr.zipcode || null,
        },
      });
    }

    return customer;
  }

  private async mapOrderItems(shopeeItems: ShopeeOrderItem[]) {
    const items: {
      productId: string;
      variationId?: string;
      quantity: number;
      unitPrice: number;
    }[] = [];

    for (const si of shopeeItems) {
      const mapping = await this.prisma.shopeeProductMapping.findUnique({
        where: { shopeeItemId: BigInt(si.item_id) },
      });

      if (!mapping) {
        this.logger.warn(`No product mapping for Shopee item ${si.item_id} (${si.item_name})`);
        continue;
      }

      items.push({
        productId: mapping.productId,
        quantity: si.model_quantity_purchased,
        unitPrice: si.model_discounted_price || si.model_original_price,
      });
    }

    return items;
  }

  /**
   * Get Shopee order mappings for display
   */
  async getOrderMappings(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.shopeeOrderMapping.findMany({
        include: {
          saleOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shopeeOrderMapping.count(),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
