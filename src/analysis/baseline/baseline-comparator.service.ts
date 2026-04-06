import { Injectable } from '@nestjs/common';

import { ArchitectureMetrics } from '../metrics/architecture-metrics.types';
import { BASELINES } from './baseline-dataset';
import { BaselineComparison } from './baseline.types';
import type { DetectedFramework } from '../../detection/detection-result.type';

// ── Framework → baseline name mapping ────────────────────────────────────────
//
// When the language detector has identified a specific framework, that identity
// is far more reliable than any metric-distance calculation. A NestJS repo with
// moderate fanOut should never rank below Phoenix just because the numbers are
// similar. We apply a bonus to any baseline whose name contains the framework
// key so that the detected framework always wins when metrics are close.
//
// The bonus is additive on the [0, 1] similarity score. 0.15 is enough to
// overcome the ~0.05–0.10 gap typically seen between well-matched baselines.

const FRAMEWORK_BASELINE_KEYWORDS: Readonly<
  Partial<Record<DetectedFramework, string[]>>
> = {
  nestjs: ['nestjs'],
  nextjs: ['nextjs', 'next'],
  angular: ['angular'],
  express: ['express'],
  fastify: ['fastify'],
  koa: ['koa'],
  django: ['django'],
  flask: ['flask'],
  fastapi: ['fastapi'],
  spring: ['spring'],
  micronaut: ['micronaut'],
  ktor: ['ktor'],
  gin: ['gin'],
  fiber: ['fiber'],
  echo: ['echo'],
  rails: ['rails'],
  sinatra: ['sinatra'],
  laravel: ['laravel'],
  symfony: ['symfony'],
  actix: ['actix'],
  axum: ['axum'],
  rocket: ['rocket'],
  vapor: ['vapor'],
  phoenix: ['phoenix'],
  play: ['play'],
  akka: ['akka'],
  flutter: ['flutter'],
  aspnet: ['aspnet', 'asp'],
};

const FRAMEWORK_MATCH_BONUS = 0.15;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class BaselineComparatorService {
  /**
   * Compare architecture metrics against all baselines and return a ranked list.
   *
   * @param metrics    Metrics from ArchitectureMetricsService.
   * @param framework  Detected framework — if provided, the matching baseline
   *                   receives a bonus so it surfaces above metrically similar
   *                   but architecturally unrelated baselines.
   */
  compare(
    metrics: ArchitectureMetrics,
    framework?: DetectedFramework,
  ): BaselineComparison[] {
    const keywords = framework
      ? (FRAMEWORK_BASELINE_KEYWORDS[framework] ?? [])
      : [];

    return BASELINES.map((baseline) => {
      const metricSimilarity = this.computeMetricSimilarity(
        metrics,
        baseline.metrics,
      );
      const bonus = keywords.some((kw) =>
        baseline.name.toLowerCase().includes(kw),
      )
        ? FRAMEWORK_MATCH_BONUS
        : 0;

      return {
        name: baseline.name,
        similarity: Number(Math.min(metricSimilarity + bonus, 1).toFixed(2)),
      };
    }).sort((a, b) => b.similarity - a.similarity);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Computes a metric-only similarity score in [0, 1].
   *
   * Algorithm: for each metric key, compute the normalised absolute difference
   * between the subject and the baseline value (capped at 1 per key so that
   * extreme outliers don't dominate). The average of those differences is
   * subtracted from 1 to produce a similarity score.
   *
   * Note: cycleCount is downweighted — a small absolute difference (0 vs 1)
   * should not swing the score as heavily as it would with raw normalisation.
   */
  private computeMetricSimilarity(
    subject: ArchitectureMetrics,
    baseline: ArchitectureMetrics,
  ): number {
    const WEIGHTS: Partial<Record<keyof ArchitectureMetrics, number>> = {
      moduleCount: 1.5, // stronger discriminator — size matters
      dependencyCount: 1.2,
      averageFanOut: 1.5, // coupling profile is highly ecosystem-specific
      averageFanIn: 1.0,
      dependencyDensity: 1.2,
      maxFanOut: 1.0,
      cycleCount: 0.5, // downweight: 0 vs 1 cycle shouldn't dominate
    };

    let totalWeight = 0;
    let weightedDifferenceSum = 0;

    for (const key of Object.keys(subject) as (keyof ArchitectureMetrics)[]) {
      const weight = WEIGHTS[key] ?? 1.0;
      const subjectValue = subject[key];
      const baselineValue = baseline[key];
      const normalisedDelta = Math.min(
        Math.abs(subjectValue - baselineValue) /
          (Math.max(subjectValue, baselineValue) || 1),
        1,
      );
      weightedDifferenceSum += normalisedDelta * weight;
      totalWeight += weight;
    }

    const averageWeightedDifference =
      weightedDifferenceSum / (totalWeight || 1);
    return Math.max(0, 1 - averageWeightedDifference);
  }
}
