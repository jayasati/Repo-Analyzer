
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisResultEntity } from './entities/analysis-result.entity';
import { PersistenceService } from './persistence.service';

@Module({
  imports:   [TypeOrmModule.forFeature([AnalysisResultEntity])],
  providers: [PersistenceService],
  exports:   [PersistenceService],
})
export class PersistenceModule {}