// ── src/copilot/copilot.module.ts ─────────────────────────────────────────────

import { Module }          from '@nestjs/common';
import { CacheModule }     from '../cache/cache.module';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { GraphQueryEngine } from './graph-query.engine';

@Module({
  imports:     [CacheModule],
  providers:   [CopilotService, GraphQueryEngine],
  controllers: [CopilotController],
})
export class CopilotModule {}