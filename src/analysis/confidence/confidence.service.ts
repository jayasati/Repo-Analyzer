import { ArchitectureMetrics } from "../metrics/architecture-metrics.types";
import { ArchitectureSmell } from "../smells/smell.types";
import { ConfidenceResult } from "./confidence.types";

import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfidenceService {

  compute(
    metrics: ArchitectureMetrics,
    smells: ArchitectureSmell[],
    cycles: { nodes: string[] }[]
  ): ConfidenceResult {

    const repoSizeFactor = this.computeRepoSizeFactor(metrics);
    const cyclePenalty = this.computeCyclePenalty(cycles);
    const smellPenalty = this.computeSmellPenalty(smells);
    const stability = this.computeStability(metrics);

    const score =
      repoSizeFactor *
      stability *
      (1 - cyclePenalty) *
      (1 - smellPenalty);

    return {
      score: Number(score.toFixed(2)),
      factors: {
        repoSizeFactor,
        cyclePenalty,
        smellPenalty,
        stability
      }
    };
  }

  private computeRepoSizeFactor(metrics: ArchitectureMetrics) {

    const size = metrics.moduleCount;

    if (size < 5) return 0.4;
    if (size < 10) return 0.6;
    if (size < 20) return 0.8;

    return 1.0;
  }

  private computeCyclePenalty(cycles: { nodes: string[] }[]) {

    if (cycles.length === 0) return 0;

    return Math.min(cycles.length * 0.1, 0.5);
  }

  private computeSmellPenalty(smells: ArchitectureSmell[]) {

    const density = smells.length;

    return Math.min(density * 0.05, 0.4);
  }

  private computeStability(metrics: ArchitectureMetrics) {

    const fanOut = metrics.averageFanOut;

    if (fanOut < 2) return 1;
    if (fanOut < 3) return 0.9;
    if (fanOut < 4) return 0.8;

    return 0.7;
  }

}