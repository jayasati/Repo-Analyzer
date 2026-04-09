// ── src/copilot/copilot.module.ts ─────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { GithubScannerModule } from '../input/github/github-scanner.module';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { GraphQueryEngine } from './graph-query.engine';
import { SourceContextService } from './source-context.service';

@Module({
  imports: [CacheModule, GithubScannerModule],
  providers: [CopilotService, GraphQueryEngine, SourceContextService],
  controllers: [CopilotController],
})
export class CopilotModule {}
