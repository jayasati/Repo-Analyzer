import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ANALYSIS_QUEUE } from './queue.constants';
import { AnalysisJobProcessor } from './analysis-job.processor';
import { CoreModule } from '../core/core.module';
import { CacheModule } from '../cache/cache.module';
import { HistoryModule } from '../history/history.module';
import { GithubModule } from '../github/github.module';
import { GateModule } from '../gate/gate.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }),
    CoreModule,
    CacheModule,
    HistoryModule,
    GithubModule,
    GateModule,
  ],
  providers:
    process.env.RUN_QUEUE_PROCESSOR === 'true' ? [AnalysisJobProcessor] : [],
  exports: [BullModule],
})
export class QueueModule {}
