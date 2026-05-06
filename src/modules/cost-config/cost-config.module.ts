import { Module } from '@nestjs/common';
import { CostConfigController } from './cost-config.controller';
import { CostConfigService } from './cost-config.service';

@Module({
  controllers: [CostConfigController],
  providers: [CostConfigService],
  exports: [CostConfigService],
})
export class CostConfigModule {}
