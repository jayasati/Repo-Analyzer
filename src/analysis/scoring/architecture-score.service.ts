import { ArchitectureSmell } from "../smells/smell.types";
import { ArchitectureScore } from "./architecture-score.types";
import { ArchitectureMetricsService } from "../metrics/architecture-metrics.service";
import { ArchitectureMetrics } from "../metrics/architecture-metrics.types";

import { Injectable } from '@nestjs/common';

@Injectable()
export class ArchitectureScoreService {

  private metricsService = new ArchitectureMetricsService();

  compute(
    packageEdges: { from: string; to: string }[],
    smells: ArchitectureSmell[],
    cycles: { nodes: string[] }[]
  ): ArchitectureScore {

    const metrics = this.metricsService.compute(packageEdges, cycles);

    const modularity = this.computeModularity(metrics);
    const coupling = this.computeCoupling(metrics);
    const smellScore = this.computeSmellPenalty(smells);

    const overall =
      modularity * 0.35 +
      coupling * 0.35 +
      smellScore * 0.30;

    return {
      overall: Math.round(overall),
      breakdown: {
        modularity: Math.round(modularity),
        coupling: Math.round(coupling),
        smells: Math.round(smellScore),
      }
    };
  }

  private computeModularity(metrics: ArchitectureMetrics) {

    const score =
      100 - Math.min(metrics.dependencyDensity * 200, 100);

    return Math.max(score, 0);
  }

  private computeCoupling(metrics: ArchitectureMetrics) {

    const avgFanOut = metrics.averageFanOut;
    const maxFanOut = metrics.maxFanOut;

    const avgScore =
      100 - Math.min(avgFanOut * 12, 100);

    const hotspotPenalty =
      Math.min(maxFanOut * 4, 40);

    const score = avgScore - hotspotPenalty;

    return Math.max(score, 0);
  }

  private computeSmellPenalty(smells: ArchitectureSmell[]) {

    const penalties: Record<string, number> = {
      "circular-dependency": 25,
      "god-module": 20,
      "hub-dependency": 15,
      "dead-module": 5
    };

    const penalty = smells.reduce(
      (sum, smell) => sum + (penalties[smell.type] ?? 10),
      0
    );

    return Math.max(100 - penalty, 0);
  }
}