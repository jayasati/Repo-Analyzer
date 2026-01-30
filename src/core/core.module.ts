import { Module } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { InputModule } from '../input/input.module';
import { DetectionModule } from '../detection/detection.module';
import { StructuralModule } from '../structural/structural.module';

@Module({
  imports: [
    InputModule,
    DetectionModule,
    StructuralModule,
  ],
  providers: [AnalyzerService],
  exports: [AnalyzerService],
})
export class CoreModule {}
