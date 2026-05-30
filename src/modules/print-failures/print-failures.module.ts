import { Module } from '@nestjs/common';
import { PrintFailuresController } from './print-failures.controller';
import { PrintFailuresService } from './print-failures.service';

@Module({
  controllers: [PrintFailuresController],
  providers:   [PrintFailuresService],
  exports:     [PrintFailuresService],
})
export class PrintFailuresModule {}
