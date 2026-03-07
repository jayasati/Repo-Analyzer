import { ArchitectureMetrics } from "../metrics/architecture-metrics.types";
import { BASELINES } from "./baseline-dataset";
import { BaselineComparison } from "./baseline.types";

export class BaselineComparatorService {

  compare(metrics: ArchitectureMetrics): BaselineComparison[] {

    return BASELINES.map(baseline => {

      const similarity = this.computeSimilarity(
        metrics,
        baseline.metrics
      );

      return {
        name: baseline.name,
        similarity: Number(similarity.toFixed(2))
      };

    }).sort((a, b) => b.similarity - a.similarity);

  }

  private computeSimilarity(
    a: ArchitectureMetrics,
    b: ArchitectureMetrics
  ): number {

    const keys = Object.keys(a) as (keyof ArchitectureMetrics)[];

    let diff = 0;

    keys.forEach(k => {

      const av = a[k];
      const bv = b[k];

      const delta = Math.abs(av - bv) / (Math.max(av, bv) || 1);

      diff += delta;

    });

    const similarity = 1 - diff / keys.length;

    return Math.max(0, similarity);

  }

}