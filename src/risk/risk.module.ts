
// ── src/risk/risk.module.ts ───────────────────────────────────────────────────

import { Module }           from '@nestjs/common';
import { RiskController }   from './risk.controller';
import { RiskScorerService } from './risk-scorer.service';
import { GitChurnService }  from './git-churn.service';
import { CacheModule }      from '../cache/cache.module';

@Module({
  imports:     [CacheModule],
  providers:   [RiskScorerService, GitChurnService],
  controllers: [RiskController],
  exports:     [RiskScorerService, GitChurnService],
})
export class RiskModule {}