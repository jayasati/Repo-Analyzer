import { Module } from '@nestjs/common';
import { GithubScannerService } from './github-scanner.service';
import { LocalScannerModule } from '../local/local-scanner.module';

@Module({
  imports: [LocalScannerModule],
  providers: [GithubScannerService],
  exports: [GithubScannerService],
})
export class GithubScannerModule {}