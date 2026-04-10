import { Module } from '@nestjs/common';

import { AnalyzerService } from './analyzer.service';
import { AnalysisPipelineService } from './pipeline/analysis-pipeline.service';
import {
  PIPELINE_SCANNERS,
  PIPELINE_ANALYZERS,
  PIPELINE_RENDERERS,
} from './pipeline/pipeline.tokens';

import { InputModule } from '../input/input.module';
import { DetectionModule } from '../detection/detection.module';
import { StructuralModule } from '../structural/structural.module';
import { SemanticModule } from '../semantic/semantic.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { DiagramModule } from '../diagram/diagram.module';
import { GraphModule } from '../graph/graph.module';

// Scan-phase services
import { LocalScannerService } from '../input/local/local-scanner.service';
import { LanguageDetectorService } from '../detection/language-detector.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';
import { SemanticAnalyzerService } from '../semantic/semantic-analyzer.service';
import { PackageGraphService } from '../analysis/graph/package-graph.service';
import { GraphMergeService } from '../graph/graph-merge.service';

// Analysis-phase services
import { CycleDetectorService } from '../analysis/cycles/cycle-detector.service';
import { SmellDetectorService } from '../analysis/smells/smell-detector.service';
import { ArchitectureMetricsService } from '../analysis/metrics/architecture-metrics.service';
import { ArchitectureScoreService } from '../analysis/scoring/architecture-score.service';
import { ConfidenceService } from '../analysis/confidence/confidence.service';
import { BaselineComparatorService } from '../analysis/baseline/baseline-comparator.service';
import { HotspotDetectorService } from '../analysis/insights/hotspot-detector.service';
import { ImpactAnalyzerService } from '../analysis/impact/impact-analyzer.service';
import { ArchitectureHealthService } from '../analysis/reports/architecture-health.service';
import { RepoSummaryService } from '../analysis/insights/repo-summary.service';

// Render-phase services
import { DiagramPrepService } from '../diagram/diagram-prep.service';
import { PlantUmlRendererService } from '../diagram/plantuml-renderer.service';
import { DiagramFilterService } from '../diagram/diagram-filter.service';

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
  providers: [
    AnalyzerService,
    AnalysisPipelineService,

    // ── Scan group ─────────────────────────────────────────────────────────
    {
      provide: PIPELINE_SCANNERS,
      useFactory: (
        scanner: LocalScannerService,
        detector: LanguageDetectorService,
        structuralAnalyzer: StructuralAnalyzerService,
        semanticAnalyzer: SemanticAnalyzerService,
        packageGraph: PackageGraphService,
        merger: GraphMergeService,
      ) => ({
        scanner,
        detector,
        structuralAnalyzer,
        semanticAnalyzer,
        packageGraph,
        merger,
      }),
      inject: [
        LocalScannerService,
        LanguageDetectorService,
        StructuralAnalyzerService,
        SemanticAnalyzerService,
        PackageGraphService,
        GraphMergeService,
      ],
    },

    // ── Analysis group ──────────────────────────────────────────────────────
    {
      provide: PIPELINE_ANALYZERS,
      useFactory: (
        cycleDetector: CycleDetectorService,
        smellDetector: SmellDetectorService,
        metricsService: ArchitectureMetricsService,
        scoreService: ArchitectureScoreService,
        confidenceService: ConfidenceService,
        baselineComparator: BaselineComparatorService,
        hotspotDetector: HotspotDetectorService,
        impactAnalyzer: ImpactAnalyzerService,
        healthService: ArchitectureHealthService,
        summaryService: RepoSummaryService,
      ) => ({
        cycleDetector,
        smellDetector,
        metricsService,
        scoreService,
        confidenceService,
        baselineComparator,
        hotspotDetector,
        impactAnalyzer,
        healthService,
        summaryService,
      }),
      inject: [
        CycleDetectorService,
        SmellDetectorService,
        ArchitectureMetricsService,
        ArchitectureScoreService,
        ConfidenceService,
        BaselineComparatorService,
        HotspotDetectorService,
        ImpactAnalyzerService,
        ArchitectureHealthService,
        RepoSummaryService,
      ],
    },

    // ── Render group ────────────────────────────────────────────────────────
    {
      provide: PIPELINE_RENDERERS,
      useFactory: (
        diagramPrep: DiagramPrepService,
        renderer: PlantUmlRendererService,
        diagramFilter: DiagramFilterService,
      ) => ({ diagramPrep, renderer, diagramFilter }),
      inject: [DiagramPrepService, PlantUmlRendererService, DiagramFilterService],
    },
  ],
  exports: [AnalyzerService, AnalysisPipelineService],
})
export class CoreModule {}
