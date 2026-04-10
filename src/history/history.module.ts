import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { RepoTargetEntity } from '../persistence/entities/repo-target.entity';
import { HistoryService } from './history.service';
import { DiffService } from './diff.service';
import { TrendService } from './trend.service';
import { RegressionDetectorService } from './regression-detector.service';
import { TargetService } from './target.service';
import { HistoryController } from './history.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisResultEntity, RepoTargetEntity]),
    AuthModule,
  ],
  providers: [
    HistoryService,
    DiffService,
    TrendService,
    RegressionDetectorService,
    TargetService,
  ],
  controllers: [HistoryController],
  exports: [HistoryService],
})
export class HistoryModule {}
