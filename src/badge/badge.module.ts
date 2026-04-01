import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { BadgeController } from './badge.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([AnalysisResultEntity])],
  controllers: [BadgeController],
})
export class BadgeModule {}