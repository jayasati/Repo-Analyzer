import { ArchitectureSmell }    from '../../analysis/smells/smell.types';
import { ArchitectureMetrics }  from '../../analysis/metrics/architecture-metrics.types';
import { ArchitectureScore }    from '../../analysis/scoring/architecture-score.types';
import { ConfidenceResult }     from '../../analysis/confidence/confidence.types';
import { BaselineComparison }   from '../../analysis/baseline/baseline.types';
import { Hotspot }              from '../../analysis/insights/hotspot.types';
import { ImpactResult }         from '../../analysis/impact/impact.types';

/**
 * Intermediate result produced by the analysis phase of the pipeline.
 * Keeps runAnalysisPhase() return type explicit and type-safe.
 */
export interface AnalysisPhaseResult {
  cycles:     { nodes: string[] }[];
  smells:     ArchitectureSmell[];
  metrics:    ArchitectureMetrics;
  score:      ArchitectureScore;
  confidence: ConfidenceResult;
  baseline:   BaselineComparison[];
  hotspots:   Hotspot[];
  impact:     ImpactResult | undefined;
}