import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopeeClientService } from './shopee-client.service';

@Injectable()
export class ShopeeLogisticsService {
  private readonly logger = new Logger(ShopeeLogisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopeeClient: ShopeeClientService,
  ) {}

  /**
   * Get available shipping parameters for an order
   */
  async getShippingParameter(orderSn: string) {
    const response = await this.shopeeClient.request<{
      response: unknown;
    }>({
      path: '/api/v2/logistics/get_shipping_parameter',
      query: { order_sn: orderSn },
    });
    return response.response;
  }

  /**
   * Request Shopee to arrange shipment (Shopee Logistics)
   */
  async shipOrder(saleOrderId: string) {
    const mapping = await this.prisma.shopeeOrderMapping.findUnique({
      where: { saleOrderId },
    });

    if (!mapping) throw new NotFoundException('Pedido não tem mapeamento Shopee');

    const shippingParam = await this.getShippingParameter(mapping.shopeeOrderSn);

    // Ship via Shopee Logistics (dropoff or pickup depending on config)
    await this.shopeeClient.request({
      path: '/api/v2/logistics/ship_order',
      method: 'POST',
      body: {
        order_sn: mapping.shopeeOrderSn,
        pickup: shippingParam,
      },
    });

    this.logger.log(`Shipment arranged for Shopee order ${mapping.shopeeOrderSn}`);
    return { orderSn: mapping.shopeeOrderSn, shipped: true };
  }

  /**
   * Get tracking info for a Shopee order
   */
  async getTrackingInfo(orderSn: string) {
    const response = await this.shopeeClient.request<{
      response: {
        tracking_number: string;
        tracking_info: unknown[];
      };
    }>({
      path: '/api/v2/logistics/get_tracking_number',
      query: { order_sn: orderSn },
    });
    return response.response;
  }

  /**
   * Get available logistics channels
   */
  async getLogisticsChannels() {
    const response = await this.shopeeClient.request<{
      response: { logistics_channel_list: unknown[] };
    }>({
      path: '/api/v2/logistics/get_channel_list',
    });
    return response.response.logistics_channel_list;
  }
}
