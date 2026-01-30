import { Module } from '@nestjs/common';
import { LocalScannerModule } from './local/local-scanner.module';
import { GithubScannerModule } from './github/github-scanner.module';

@Module({
  imports: [LocalScannerModule,
            GithubScannerModule,
  ],
  exports: [LocalScannerModule,
            GithubScannerModule,
  ],
})
export class InputModule {}
