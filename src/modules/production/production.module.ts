import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { CostEngineService } from './cost-engine.service';

@Module({
  controllers: [ProductionController],
  providers: [ProductionService, CostEngineService],
  exports: [CostEngineService, ProductionService],
})
export class ProductionModule {}
