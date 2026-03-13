import { Injectable } from '@nestjs/common';

import { ArchitectureMetrics } from '../metrics/architecture-metrics.types';
import { ArchitectureSmell }   from '../smells/smell.types';
import { ConfidenceResult }    from './confidence.types';

@Injectable()
export class ConfidenceService {

  // ─── Configuration ───────────────────────────────────────────────────────

  /**
   * Maps module-count upper bounds to a repo-size confidence factor.
   * The first tier whose threshold exceeds the actual count is used;
   * repos larger than all tiers receive the maximum factor of 1.0.
   */
  private static readonly SIZE_FACTOR_TIERS = [
    { threshold:  5, factor: 0.4 },
    { threshold: 10, factor: 0.6 },
    { threshold: 20, factor: 0.8 },
  ] as const;

  /** Penalty applied per detected cycle; capped at MAX_CYCLE_PENALTY. */
  private static readonly CYCLE_PENALTY_RATE  = 0.10;
  private static readonly MAX_CYCLE_PENALTY   = 0.50;

  /** Penalty applied per detected smell; capped at MAX_SMELL_PENALTY. */
  private static readonly SMELL_PENALTY_RATE  = 0.05;
  private static readonly MAX_SMELL_PENALTY   = 0.40;

  /**
   * Stability factor tiers keyed by average fan-out upper bound.
   * Lower fan-out → higher stability.
   */
  private static readonly STABILITY_TIERS = [
    { maxFanOut: 2, stability: 1.0 },
    { maxFanOut: 3, stability: 0.9 },
    { maxFanOut: 4, stability: 0.8 },
  ] as const;
  private static readonly MIN_STABILITY = 0.7;

  // ─── Public API ──────────────────────────────────────────────────────────

  compute(
    metrics: ArchitectureMetrics,
    smells:  ArchitectureSmell[],
    cycles:  { nodes: string[] }[],
  ): ConfidenceResult {
    const repoSizeFactor = this.computeRepoSizeFactor(metrics);
    const cyclePenalty   = this.computeCyclePenalty(cycles);
    const smellPenalty   = this.computeSmellPenalty(smells);
    const stability      = this.computeStability(metrics);

    const score =
      repoSizeFactor *
      stability      *
      (1 - cyclePenalty) *
      (1 - smellPenalty);

    return {
      score:   Number(score.toFixed(2)),
      factors: { repoSizeFactor, cyclePenalty, smellPenalty, stability },
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private computeRepoSizeFactor(metrics: ArchitectureMetrics): number {
    const tier = ConfidenceService.SIZE_FACTOR_TIERS.find(
      t => metrics.moduleCount < t.threshold,
    );
    return tier?.factor ?? 1.0;
  }

  private computeCyclePenalty(cycles: { nodes: string[] }[]): number {
    const { CYCLE_PENALTY_RATE, MAX_CYCLE_PENALTY } = ConfidenceService;
    return Math.min(cycles.length * CYCLE_PENALTY_RATE, MAX_CYCLE_PENALTY);
  }

  private computeSmellPenalty(smells: ArchitectureSmell[]): number {
    const { SMELL_PENALTY_RATE, MAX_SMELL_PENALTY } = ConfidenceService;
    return Math.min(smells.length * SMELL_PENALTY_RATE, MAX_SMELL_PENALTY);
  }

  private computeStability(metrics: ArchitectureMetrics): number {
    const tier = ConfidenceService.STABILITY_TIERS.find(
      t => metrics.averageFanOut < t.maxFanOut,
    );
    return tier?.stability ?? ConfidenceService.MIN_STABILITY;
  }
}