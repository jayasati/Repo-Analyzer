import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { HistoryService }    from './history.service';
import { DiffService }       from './diff.service';
import { TrendService }      from './trend.service';
import { HistoryController } from './history.controller';
import { AuthModule }        from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AnalysisResultEntity]),
    AuthModule,
  ],
  providers:   [HistoryService, DiffService, TrendService],
  controllers: [HistoryController],
  exports:     [HistoryService],
})
export class HistoryModule {}