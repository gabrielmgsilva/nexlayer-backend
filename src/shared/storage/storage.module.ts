import { Global, Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useClass: R2StorageService,
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
