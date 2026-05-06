import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationsService } from '../integrations/integrations.service';
import { ShopeeOrdersService } from './shopee-orders.service';
import { ShopeeProductsService } from './shopee-products.service';
import { ShopeeClientService } from './shopee-client.service';

@Injectable()
export class ShopeeCronService {
  private readonly logger = new Logger(ShopeeCronService.name);

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly ordersService: ShopeeOrdersService,
    private readonly productsService: ShopeeProductsService,
    private readonly shopeeClient: ShopeeClientService,
  ) {}

  /**
   * Sync orders every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncOrders() {
    if (!(await this.isConnected())) return;

    this.logger.log('Cron: syncing Shopee orders...');
    try {
      const result = await this.ordersService.syncOrders();
      this.logger.log(`Cron: orders synced — imported=${result.imported}, skipped=${result.skipped}, errors=${result.errors}`);
    } catch (err) {
      this.logger.error('Cron: order sync failed', err);
    }
  }

  /**
   * Push stock to Shopee every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncStock() {
    if (!(await this.isConnected())) return;

    this.logger.log('Cron: pushing stock to Shopee...');
    try {
      const result = await this.productsService.syncAllStock();
      this.logger.log(`Cron: stock synced — ${result.synced}/${result.total}, errors=${result.errors}`);
    } catch (err) {
      this.logger.error('Cron: stock sync failed', err);
    }
  }

  /**
   * Refresh access token proactively (every 3 hours)
   */
  @Cron('0 */3 * * *')
  async refreshToken() {
    if (!(await this.isConnected())) return;

    this.logger.log('Cron: refreshing Shopee access token...');
    try {
      const ok = await this.shopeeClient.refreshAccessToken();
      this.logger.log(`Cron: token refresh ${ok ? 'succeeded' : 'failed'}`);
    } catch (err) {
      this.logger.error('Cron: token refresh failed', err);
    }
  }

  private async isConnected(): Promise<boolean> {
    const shopId = await this.integrations.get('shopee', 'shop_id');
    return !!shopId;
  }
}
