import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { CoreModule } from '../core/core.module';

@Module({
  imports: [CoreModule],
  controllers: [AnalyzeController],
})
export class ApiModule {}
