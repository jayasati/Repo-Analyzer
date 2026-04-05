// ── src/timeline/timeline.module.ts ──────────────────────────────────────────

import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([AnalysisResultEntity])],
  providers:   [TimelineService],
  controllers: [TimelineController],
})
export class TimelineModule {}