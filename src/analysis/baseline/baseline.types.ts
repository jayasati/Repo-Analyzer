import { ArchitectureMetrics } from '../metrics/architecture-metrics.types';

export interface ArchitectureBaseline {
  name:         string;
  description?: string;   // human-readable summary of what this baseline represents
  metrics:      ArchitectureMetrics;
}

export interface BaselineComparison {
  name:       string;
  similarity: number;
}