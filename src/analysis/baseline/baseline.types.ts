import { ArchitectureMetrics } from "../metrics/architecture-metrics.types";

export interface ArchitectureBaseline {
  name: string;
  metrics: ArchitectureMetrics;
}

export interface BaselineComparison {
  name: string;
  similarity: number;
}