import { Module } from '@nestjs/common';
import { GithubApiService } from './github-api.service';
import { GithubIntegrationService } from './github-integration.service';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [GithubApiService, GithubIntegrationService],
  exports: [GithubApiService, GithubIntegrationService],
})
export class GithubModule {}
