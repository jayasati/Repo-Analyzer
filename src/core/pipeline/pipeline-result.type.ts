import { DetectionResult } from "../../detection/detection-result.type";
import { UnifiedGraph } from "../../graph/unified-graph.types";
import { ArchitectureScore } from "../../analysis/scoring/architecture-score.types";
import { ArchitectureSmell } from "../../analysis/smells/smell.types";
import { ArchitectureMetrics } from "../../analysis/metrics/architecture-metrics.types";
import { RepoSummary } from "../../analysis/insights/repo-summary.types";
import { Hotspot } from "../../analysis/insights/hotspot.types";

export interface PipelineResult {
  projectName: string;

  summary: RepoSummary;

  detection: DetectionResult;

  unifiedGraph: UnifiedGraph;

  metrics: ArchitectureMetrics;

  smells: ArchitectureSmell[];

  cycles: { nodes: string[] }[];

  hotspots: Hotspot[];

  score: ArchitectureScore;

  diagrams?: {
    classDiagram?: string;
    componentDiagram?: string;
    sequenceDiagram?: string;
  };
}