// AFTER: src/core/core.module.ts
import { Module } from '@nestjs/common';
import { AnalyzerService } from './analyzer.service';
import { InputModule } from '../input/input.module';
import { DetectionModule } from '../detection/detection.module';
import { StructuralModule } from '../structural/structural.module';
import { SemanticModule } from '../semantic/semantic.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { DiagramModule } from '../diagram/diagram.module';
import { GraphModule } from '../graph/graph.module';
import { AnalysisPipelineService } from './pipeline/analysis-pipeline.service';

@Module({
  imports: [
    InputModule,
    DetectionModule,
    StructuralModule,
    SemanticModule,
    AnalysisModule,
    DiagramModule,
    GraphModule,
  ],
  providers: [AnalyzerService, AnalysisPipelineService],
  exports: [AnalyzerService, AnalysisPipelineService],
})
export class CoreModule {}