import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopeeClientService } from './shopee-client.service';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class ShopeeAuthService {
  private readonly logger = new Logger(ShopeeAuthService.name);
  private readonly redirectUrl: string;

  constructor(
    private readonly shopeeClient: ShopeeClientService,
    private readonly integrations: IntegrationsService,
    private readonly config: ConfigService,
  ) {
    this.redirectUrl = this.config.get<string>(
      'SHOPEE_REDIRECT_URL',
      'http://localhost:3000/api/shopee/auth/callback',
    );
  }

  getAuthorizationUrl(): string {
    return this.shopeeClient.getAuthUrl(this.redirectUrl);
  }

  async handleCallback(code: string, shopId: number) {
    this.logger.log(`Shopee OAuth callback for shop ${shopId}`);
    return this.shopeeClient.exchangeCodeForToken(code, shopId);
  }

  async getConnectionStatus() {
    const configs = await this.integrations.getAllByProvider('shopee');
    const shopId = await this.integrations.get('shopee', 'shop_id');
    const tokenData = await this.integrations.getWithExpiry('shopee', 'access_token');

    return {
      isConnected: configs.length > 0 && !!shopId,
      shopId: shopId ? Number(shopId) : null,
      tokenExpiresAt: tokenData?.expiresAt ?? null,
      configKeys: configs.map((c) => c.key),
    };
  }

  async disconnect() {
    await this.integrations.deleteProvider('shopee');
    this.logger.log('Shopee integration disconnected');
  }
}
