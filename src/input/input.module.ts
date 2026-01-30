import { Module } from '@nestjs/common';
import { LocalScannerModule } from './local/local-scanner.module';

@Module({
  imports: [LocalScannerModule],
  exports: [LocalScannerModule],
})
export class InputModule {}
