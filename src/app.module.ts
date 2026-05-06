import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AlertsModule } from './shared/alerts/alerts.module';
import { StorageModule } from './shared/storage/storage.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DomainModule } from './modules/domain/domain.module';
import { AuthModule } from './modules/auth/auth.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { AccessoriesModule } from './modules/accessories/accessories.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { CostConfigModule } from './modules/cost-config/cost-config.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductionModule } from './modules/production/production.module';
import { CalculatorModule } from './modules/calculator/calculator.module';
import { SalesModule } from './modules/sales/sales.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ShopeeModule } from './modules/shopee/shopee.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },   // 20 req/s por IP
      { name: 'medium', ttl: 60000, limit: 300 }, // 300 req/min por IP
    ]),
    PrismaModule,
    StorageModule,
    AlertsModule,
    NotificationsModule,
    DomainModule,
    AuthModule,
    SuppliersModule,
    EquipmentModule,
    MaterialsModule,
    AccessoriesModule,
    CategoriesModule,
    ProductsModule,
    CostConfigModule,
    CustomersModule,
    ProductionModule,
    CalculatorModule,
    SalesModule,
    DashboardModule,
    IntegrationsModule,
    ShopeeModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
