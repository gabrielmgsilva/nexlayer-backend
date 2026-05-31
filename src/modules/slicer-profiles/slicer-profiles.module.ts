import { Module } from '@nestjs/common';
import { SlicerProfilesController } from './slicer-profiles.controller';
import { SlicerProfilesService } from './slicer-profiles.service';

@Module({
  controllers: [SlicerProfilesController],
  providers: [SlicerProfilesService],
  exports: [SlicerProfilesService],
})
export class SlicerProfilesModule {}
