import { CycleDetectorService }       from '../../analysis/cycles/cycle-detector.service';
import { SmellDetectorService }        from '../../analysis/smells/smell-detector.service';
import { ArchitectureMetricsService }  from '../../analysis/metrics/architecture-metrics.service';
import { ArchitectureScoreService }    from '../../analysis/scoring/architecture-score.service';
import { ConfidenceService }           from '../../analysis/confidence/confidence.service';
import { BaselineComparatorService }   from '../../analysis/baseline/baseline-comparator.service';
import { HotspotDetectorService }      from '../../analysis/insights/hotspot-detector.service';
import { ImpactAnalyzerService }       from '../../analysis/impact/impact-analyzer.service';
import { ArchitectureHealthService }   from '../../analysis/reports/architecture-health.service';
import { RepoSummaryService }          from '../../analysis/insights/repo-summary.service';

/**
 * Groups all analysis-phase dependencies injected into AnalysisPipelineService.
 * Provided as a single token (PIPELINE_ANALYZERS) to keep the constructor lean.
 */
export interface PipelineAnalyzers {
  cycleDetector:      CycleDetectorService;
  smellDetector:      SmellDetectorService;
  metricsService:     ArchitectureMetricsService;
  scoreService:       ArchitectureScoreService;
  confidenceService:  ConfidenceService;
  baselineComparator: BaselineComparatorService;
  hotspotDetector:    HotspotDetectorService;
  impactAnalyzer:     ImpactAnalyzerService;
  healthService:      ArchitectureHealthService;
  summaryService:     RepoSummaryService;
}
