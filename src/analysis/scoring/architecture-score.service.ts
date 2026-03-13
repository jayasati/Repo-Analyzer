import { Injectable } from '@nestjs/common';

import { ArchitectureSmell }         from '../smells/smell.types';
import { ArchitectureScore }         from './architecture-score.types';
import { ArchitectureMetricsService } from '../metrics/architecture-metrics.service';
import { ArchitectureMetrics }       from '../metrics/architecture-metrics.types';

@Injectable()
export class ArchitectureScoreService {

  // ─── Scoring model constants ─────────────────────────────────────────────
  // Changing these is the only place needed to tune the scoring model.

  private static readonly WEIGHTS = {
    modularity: 0.35,
    coupling:   0.35,
    smells:     0.30,
  } as const;

  private static readonly MODULARITY = {
    /** Multiplier applied to dependency density when computing the modularity score. */
    densityMultiplier: 200,
  } as const;

  private static readonly COUPLING = {
    /** Penalty points per unit of average fan-out. */
    avgFanOutPenaltyRate:  12,
    /** Penalty points per unit of max fan-out (hotspot penalty). */
    maxFanOutPenaltyRate:   4,
    /** Cap on the hotspot penalty so a single outlier can't zero the score. */
    maxHotspotPenalty:     40,
  } as const;

  private static readonly SMELL_PENALTIES: Readonly<Record<string, number>> = {
    'circular-dependency': 25,
    'god-module':          20,
    'hub-dependency':      15,
    'dead-module':          5,
  };

  // ─── DI ─────────────────────────────────────────────────────────────────

  constructor(private readonly metricsService: ArchitectureMetricsService) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  compute(
    packageEdges: { from: string; to: string }[],
    smells:       ArchitectureSmell[],
    cycles:       { nodes: string[] }[],
  ): ArchitectureScore {
    const metrics    = this.metricsService.compute(packageEdges, cycles);
    const modularity = this.computeModularity(metrics);
    const coupling   = this.computeCoupling(metrics);
    const smellScore = this.computeSmellScore(smells);

    const { WEIGHTS } = ArchitectureScoreService;

    const overall =
      modularity  * WEIGHTS.modularity +
      coupling    * WEIGHTS.coupling +
      smellScore  * WEIGHTS.smells;

    return {
      overall: Math.round(overall),
      breakdown: {
        modularity: Math.round(modularity),
        coupling:   Math.round(coupling),
        smells:     Math.round(smellScore),
      },
    };
  }

  // ─── Private scoring helpers ─────────────────────────────────────────────

  private computeModularity(metrics: ArchitectureMetrics): number {
    const { densityMultiplier } = ArchitectureScoreService.MODULARITY;
    const score = 100 - Math.min(metrics.dependencyDensity * densityMultiplier, 100);
    return Math.max(score, 0);
  }

  private computeCoupling(metrics: ArchitectureMetrics): number {
    const { avgFanOutPenaltyRate, maxFanOutPenaltyRate, maxHotspotPenalty } =
      ArchitectureScoreService.COUPLING;

    const avgScore       = 100 - Math.min(metrics.averageFanOut * avgFanOutPenaltyRate, 100);
    const hotspotPenalty = Math.min(metrics.maxFanOut * maxFanOutPenaltyRate, maxHotspotPenalty);

    return Math.max(avgScore - hotspotPenalty, 0);
  }

  private computeSmellScore(smells: ArchitectureSmell[]): number {
    const penalties = ArchitectureScoreService.SMELL_PENALTIES;

    const totalPenalty = smells.reduce(
      (sum, smell) => sum + (penalties[smell.type] ?? 10),
      0,
    );

    return Math.max(100 - totalPenalty, 0);
  }
}