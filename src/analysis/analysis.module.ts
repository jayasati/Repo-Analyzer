
import { Module } from '@nestjs/common';
import { PackageGraphService } from './graph/package-graph.service';
import { CycleDetectorService } from './cycles/cycle-detector.service';
import { SmellDetectorService } from './smells/smell-detector.service';
import { ArchitectureMetricsService } from './metrics/architecture-metrics.service';
import { ArchitectureScoreService } from './scoring/architecture-score.service';
import { RepoSummaryService } from './insights/repo-summary.service';
import { HotspotDetectorService } from './insights/hotspot-detector.service';
import { ImpactAnalyzerService } from './impact/impact-analyzer.service';
import { ArchitectureHealthService } from './reports/architecture-health.service';
import { ConfidenceService } from './confidence/confidence.service';
import { BaselineComparatorService } from './baseline/baseline-comparator.service';

const ANALYSIS_PROVIDERS = [
  PackageGraphService,
  CycleDetectorService,
  SmellDetectorService,
  ArchitectureMetricsService,
  ArchitectureScoreService,
  RepoSummaryService,
  HotspotDetectorService,
  ImpactAnalyzerService,
  ArchitectureHealthService,
  ConfidenceService,
  BaselineComparatorService,
];

@Module({
  providers: ANALYSIS_PROVIDERS,
  exports: ANALYSIS_PROVIDERS,
})
export class AnalysisModule {}