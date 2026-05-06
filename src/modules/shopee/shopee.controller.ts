import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { ShopeeAuthService } from './shopee-auth.service';
import { ShopeeOrdersService } from './shopee-orders.service';
import { ShopeeProductsService } from './shopee-products.service';
import { ShopeeLogisticsService } from './shopee-logistics.service';

@ApiTags('Shopee')
@Controller('shopee')
export class ShopeeController {
  constructor(
    private readonly authService: ShopeeAuthService,
    private readonly ordersService: ShopeeOrdersService,
    private readonly productsService: ShopeeProductsService,
    private readonly logisticsService: ShopeeLogisticsService,
    private readonly config: ConfigService,
  ) {}

  // ── Auth ──────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('auth/url')
  getAuthUrl() {
    const url = this.authService.getAuthorizationUrl();
    return { url };
  }

  /**
   * OAuth callback — Shopee redirects here after user approves.
   * No JWT guard: this is called by Shopee redirect.
   */
  @Get('auth/callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('shop_id') shopId: string,
    @Res() res: Response,
  ) {
    await this.authService.handleCallback(code, Number(shopId));
    // Redirect to frontend integrations page
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    res.redirect(`${frontendUrl}/settings/integrations?shopee=connected`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/status')
  getConnectionStatus() {
    return this.authService.getConnectionStatus();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('auth/disconnect')
  disconnect() {
    return this.authService.disconnect();
  }

  // ── Orders ────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('orders/sync')
  syncOrders() {
    return this.ordersService.syncOrders();
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/mappings')
  getOrderMappings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getOrderMappings(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  // ── Products ──────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('products/categories')
  getCategories() {
    return this.productsService.getCategories();
  }

  @UseGuards(JwtAuthGuard)
  @Post('products/:productId/publish')
  publishProduct(
    @Param('productId') productId: string,
    @Body('shopeeCategoryId') shopeeCategoryId: number,
  ) {
    return this.productsService.publishProduct(productId, shopeeCategoryId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('products/:productId/sync-stock')
  syncProductStock(@Param('productId') productId: string) {
    return this.productsService.syncStock(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('products/:productId/update')
  updateProduct(@Param('productId') productId: string) {
    return this.productsService.updateProduct(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('products/:productId/unpublish')
  unpublishProduct(@Param('productId') productId: string) {
    return this.productsService.unpublishProduct(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('products/sync-all-stock')
  syncAllStock() {
    return this.productsService.syncAllStock();
  }

  @UseGuards(JwtAuthGuard)
  @Get('products/mappings')
  getProductMappings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.getProductMappings(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  // ── Logistics ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logistics/:saleOrderId/ship')
  shipOrder(@Param('saleOrderId') saleOrderId: string) {
    return this.logisticsService.shipOrder(saleOrderId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('logistics/channels')
  getLogisticsChannels() {
    return this.logisticsService.getLogisticsChannels();
  }
}
