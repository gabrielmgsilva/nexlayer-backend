import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SalesModule } from '../sales/sales.module';
import { ShopeeController } from './shopee.controller';
import { ShopeeClientService } from './shopee-client.service';
import { ShopeeAuthService } from './shopee-auth.service';
import { ShopeeOrdersService } from './shopee-orders.service';
import { ShopeeProductsService } from './shopee-products.service';
import { ShopeeLogisticsService } from './shopee-logistics.service';
import { ShopeeCronService } from './shopee-cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    IntegrationsModule,
    SalesModule,
  ],
  controllers: [ShopeeController],
  providers: [
    ShopeeClientService,
    ShopeeAuthService,
    ShopeeOrdersService,
    ShopeeProductsService,
    ShopeeLogisticsService,
    ShopeeCronService,
  ],
  exports: [ShopeeClientService],
})
export class ShopeeModule {}
