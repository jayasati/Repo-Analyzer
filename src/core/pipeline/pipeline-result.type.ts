import { DetectionResult } from "../../detection/detection-result.type";
import { UnifiedGraph } from "../../graph/unified-graph.types";
import { ArchitectureScore } from "../../analysis/scoring/architecture-score.types";
import { ArchitectureSmell } from "../../analysis/smells/smell.types";
import { ArchitectureMetrics } from "../../analysis/metrics/architecture-metrics.types";

export interface PipelineResult {
  projectName: string;

  detection: DetectionResult;

  unifiedGraph: UnifiedGraph;

  metrics: ArchitectureMetrics;

  smells: ArchitectureSmell[];

  cycles: { nodes: string[] }[];

  score: ArchitectureScore;

  diagrams?: {
    classDiagram?: string;
    componentDiagram?: string;
    sequenceDiagram?: string;
  };
}