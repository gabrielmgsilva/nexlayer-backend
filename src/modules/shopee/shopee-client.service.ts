import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { IntegrationsService } from '../integrations/integrations.service';

export interface ShopeeRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, string | number>;
  requireAuth?: boolean;
}

@Injectable()
export class ShopeeClientService {
  private readonly logger = new Logger(ShopeeClientService.name);
  private readonly partnerId: number;
  private readonly partnerKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly integrations: IntegrationsService,
  ) {
    this.partnerId = Number(this.config.get<string>('SHOPEE_PARTNER_ID'));
    this.partnerKey = this.config.get<string>('SHOPEE_PARTNER_KEY');
    this.baseUrl = this.config.get<string>('SHOPEE_BASE_URL', 'https://openplatform.shopee.com.br');
  }

  /**
   * Generate HMAC-SHA256 signature for Shopee API
   * Format: partner_id + path + timestamp [+ access_token] [+ shop_id]
   */
  private sign(path: string, timestamp: number, accessToken?: string, shopId?: number): string {
    let baseString = `${this.partnerId}${path}${timestamp}`;
    if (accessToken) baseString += accessToken;
    if (shopId) baseString += shopId;
    return createHmac('sha256', this.partnerKey).update(baseString).digest('hex');
  }

  /**
   * Build the OAuth authorization URL
   */
  getAuthUrl(redirectUrl: string): string {
    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.sign(path, timestamp);
    const params = new URLSearchParams({
      partner_id: String(this.partnerId),
      timestamp: String(timestamp),
      sign,
      redirect: redirectUrl,
    });
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  /**
   * Perform a signed request to Shopee API
   */
  async request<T = unknown>(options: ShopeeRequestOptions): Promise<T> {
    const { path, method = 'GET', body, query = {}, requireAuth = true } = options;
    const timestamp = Math.floor(Date.now() / 1000);

    let accessToken: string | undefined;
    let shopId: number | undefined;

    if (requireAuth) {
      const tokenResult = await this.getValidAccessToken();
      if (!tokenResult) {
        throw new Error('Shopee not connected. Please authenticate first.');
      }
      accessToken = tokenResult.accessToken;
      shopId = tokenResult.shopId;
    }

    const sign = this.sign(path, timestamp, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: String(this.partnerId),
      timestamp: String(timestamp),
      sign,
      ...Object.fromEntries(
        Object.entries(query).map(([k, v]) => [k, String(v)]),
      ),
    });

    if (accessToken) params.set('access_token', accessToken);
    if (shopId) params.set('shop_id', String(shopId));

    const url = `${this.baseUrl}${path}?${params.toString()}`;
    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    this.logger.debug(`Shopee ${method} ${path}`);

    const response = await fetch(url, fetchOptions);
    const data = await response.json() as { error?: string; message?: string };

    if (data.error && data.error !== '') {
      this.logger.error(`Shopee API error: ${data.error} - ${data.message}`);
      throw new Error(`Shopee API: ${data.error} - ${data.message}`);
    }

    return data as T;
  }

  /**
   * Exchange auth code for access & refresh tokens
   */
  async exchangeCodeForToken(code: string, shopId: number) {
    const path = '/api/v2/auth/token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.sign(path, timestamp);

    const url = `${this.baseUrl}${path}?partner_id=${this.partnerId}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        shop_id: shopId,
        partner_id: this.partnerId,
      }),
    });

    const data = await response.json() as {
      error?: string;
      message?: string;
      access_token?: string;
      refresh_token?: string;
      expire_in?: number;
    };

    if (data.error && data.error !== '') {
      throw new Error(`Shopee token exchange failed: ${data.error} - ${data.message}`);
    }

    // Store tokens encrypted
    const now = new Date();
    const accessExpiry = new Date(now.getTime() + (data.expire_in || 14400) * 1000);

    await Promise.all([
      this.integrations.upsert('shopee', 'access_token', data.access_token, accessExpiry),
      this.integrations.upsert('shopee', 'refresh_token', data.refresh_token),
      this.integrations.upsert('shopee', 'shop_id', String(shopId)),
    ]);

    return { shopId, expiresAt: accessExpiry };
  }

  /**
   * Refresh expired access token using refresh_token
   */
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = await this.integrations.get('shopee', 'refresh_token');
    const shopIdStr = await this.integrations.get('shopee', 'shop_id');

    if (!refreshToken || !shopIdStr) return false;

    const shopId = Number(shopIdStr);
    const path = '/api/v2/auth/access_token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = this.sign(path, timestamp);

    const url = `${this.baseUrl}${path}?partner_id=${this.partnerId}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshToken,
        shop_id: shopId,
        partner_id: this.partnerId,
      }),
    });

    const data = await response.json() as {
      error?: string;
      message?: string;
      access_token?: string;
      refresh_token?: string;
      expire_in?: number;
    };

    if (data.error && data.error !== '') {
      this.logger.error(`Shopee token refresh failed: ${data.error}`);
      return false;
    }

    const now = new Date();
    const accessExpiry = new Date(now.getTime() + (data.expire_in || 14400) * 1000);

    await Promise.all([
      this.integrations.upsert('shopee', 'access_token', data.access_token, accessExpiry),
      this.integrations.upsert('shopee', 'refresh_token', data.refresh_token),
    ]);

    return true;
  }

  /**
   * Get valid access token, refreshing if near expiry
   */
  private async getValidAccessToken(): Promise<{ accessToken: string; shopId: number } | null> {
    const tokenData = await this.integrations.getWithExpiry('shopee', 'access_token');
    const shopIdStr = await this.integrations.get('shopee', 'shop_id');

    if (!tokenData || !shopIdStr) return null;

    const shopId = Number(shopIdStr);

    // Refresh if expires within 5 minutes
    if (tokenData.expiresAt && tokenData.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) return null;
      const newToken = await this.integrations.get('shopee', 'access_token');
      return newToken ? { accessToken: newToken, shopId } : null;
    }

    return { accessToken: tokenData.value, shopId };
  }
}
