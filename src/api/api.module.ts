import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalyzeController } from './analyze.controller';
import { GraphController } from './graph.controller';
import { CoreModule } from '../core/core.module';
import { CacheModule } from '../cache/cache.module';
import { ANALYSIS_QUEUE } from '../queue/queue.constants';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    CoreModule,
    CacheModule,
    ReportModule,
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }),
  ],
  controllers: [AnalyzeController, GraphController],
})
export class ApiModule {}
