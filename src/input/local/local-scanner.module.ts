import { Module } from '@nestjs/common';
import { LocalScannerService } from './local-scanner.service';

@Module({
  providers: [LocalScannerService],
  exports: [LocalScannerService],
})
export class LocalScannerModule {}