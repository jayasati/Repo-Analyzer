import { Injectable } from '@nestjs/common';

import { ArchitectureMetrics } from '../metrics/architecture-metrics.types';
import { ArchitectureSmell } from '../smells/smell.types';
import { ConfidenceResult } from './confidence.types';
import type { DetectedFramework } from '../../detection/detection-result.type';

// ── Per-framework stability profiles ──────────────────────────────────────────
//
// averageFanOut bands → stability factor.
// DI-heavy frameworks (NestJS, Spring, Angular) tolerate higher fan-out
// before stability degrades. Micro-frameworks and ownership-constrained
// languages (Rust, Go) expect very low fan-out.
//
// Each profile is an array of { maxFanOut, stability } tiers sorted ascending.
// The first tier whose maxFanOut exceeds the repo's averageFanOut is used.
// If no tier matches, minStability is returned.

interface StabilityTier {
  maxFanOut: number;
  stability: number;
}

interface StabilityProfile {
  tiers: StabilityTier[];
  minStability: number;
}

const STABILITY_PROFILES: Readonly<Record<string, StabilityProfile>> = {
  // ── DI-heavy frameworks ──────────────────────────────────────────────────
  nestjs: {
    tiers: [
      { maxFanOut: 4, stability: 1.0 },
      { maxFanOut: 6, stability: 0.9 },
      { maxFanOut: 8, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  spring: {
    tiers: [
      { maxFanOut: 4, stability: 1.0 },
      { maxFanOut: 6, stability: 0.9 },
      { maxFanOut: 8, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  angular: {
    tiers: [
      { maxFanOut: 5, stability: 1.0 },
      { maxFanOut: 8, stability: 0.9 },
      { maxFanOut: 10, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  aspnet: {
    tiers: [
      { maxFanOut: 4, stability: 1.0 },
      { maxFanOut: 6, stability: 0.9 },
      { maxFanOut: 8, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  symfony: {
    tiers: [
      { maxFanOut: 4, stability: 1.0 },
      { maxFanOut: 6, stability: 0.9 },
      { maxFanOut: 8, stability: 0.8 },
    ],
    minStability: 0.65,
  },

  // ── Moderate frameworks ──────────────────────────────────────────────────
  laravel: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 7, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  rails: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 7, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  django: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 6, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  nextjs: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 6, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  phoenix: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 7, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  micronaut: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 7, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  ktor: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 6, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  play: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 6, stability: 0.8 },
    ],
    minStability: 0.65,
  },
  akka: {
    tiers: [
      { maxFanOut: 3, stability: 1.0 },
      { maxFanOut: 5, stability: 0.9 },
      { maxFanOut: 6, stability: 0.8 },
    ],
    minStability: 0.65,
  },

  // ── Micro-frameworks ─────────────────────────────────────────────────────
  express: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 4, stability: 0.85 },
      { maxFanOut: 6, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  koa: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 4, stability: 0.85 },
      { maxFanOut: 6, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  fastify: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 4, stability: 0.85 },
      { maxFanOut: 6, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  flask: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 4, stability: 0.85 },
      { maxFanOut: 5, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  fastapi: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 4, stability: 0.85 },
      { maxFanOut: 5, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  sinatra: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
    ],
    minStability: 0.6,
  },

  // ── Strict / ownership-constrained ───────────────────────────────────────
  gin: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  fiber: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  echo: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  actix: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  axum: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  rocket: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  vapor: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
  flutter: {
    tiers: [
      { maxFanOut: 2, stability: 1.0 },
      { maxFanOut: 3, stability: 0.85 },
      { maxFanOut: 4, stability: 0.75 },
    ],
    minStability: 0.6,
  },
};

const DEFAULT_STABILITY_PROFILE: StabilityProfile = {
  tiers: [
    { maxFanOut: 2, stability: 1.0 },
    { maxFanOut: 3, stability: 0.9 },
    { maxFanOut: 4, stability: 0.8 },
  ],
  minStability: 0.7,
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ConfidenceService {
  // ── Configuration ────────────────────────────────────────────────────────

  private static readonly SIZE_FACTOR_TIERS = [
    { threshold: 5, factor: 0.4 },
    { threshold: 10, factor: 0.6 },
    { threshold: 20, factor: 0.8 },
  ] as const;

  private static readonly CYCLE_PENALTY_RATE = 0.1;
  private static readonly MAX_CYCLE_PENALTY = 0.5;

  private static readonly SMELL_PENALTY_RATE = 0.05;
  private static readonly MAX_SMELL_PENALTY = 0.4;

  // ── Public API ───────────────────────────────────────────────────────────

  compute(
    metrics: ArchitectureMetrics,
    smells: ArchitectureSmell[],
    cycles: { nodes: string[] }[],
    framework?: DetectedFramework,
  ): ConfidenceResult {
    const repoSizeFactor = this.computeRepoSizeFactor(metrics);
    const cyclePenalty = this.computeCyclePenalty(cycles);
    const smellPenalty = this.computeSmellPenalty(smells);
    const stability = this.computeStability(metrics, framework);

    const score =
      repoSizeFactor * stability * (1 - cyclePenalty) * (1 - smellPenalty);

    return {
      score: Number(score.toFixed(2)),
      factors: { repoSizeFactor, cyclePenalty, smellPenalty, stability },
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private computeRepoSizeFactor(metrics: ArchitectureMetrics): number {
    const tier = ConfidenceService.SIZE_FACTOR_TIERS.find(
      (t) => metrics.moduleCount < t.threshold,
    );
    return tier?.factor ?? 1.0;
  }

  private computeCyclePenalty(cycles: { nodes: string[] }[]): number {
    return Math.min(
      cycles.length * ConfidenceService.CYCLE_PENALTY_RATE,
      ConfidenceService.MAX_CYCLE_PENALTY,
    );
  }

  private computeSmellPenalty(smells: ArchitectureSmell[]): number {
    return Math.min(
      smells.length * ConfidenceService.SMELL_PENALTY_RATE,
      ConfidenceService.MAX_SMELL_PENALTY,
    );
  }

  private computeStability(
    metrics: ArchitectureMetrics,
    framework?: DetectedFramework,
  ): number {
    const profile =
      framework && STABILITY_PROFILES[framework]
        ? STABILITY_PROFILES[framework]
        : DEFAULT_STABILITY_PROFILE;

    const tier = profile.tiers.find((t) => metrics.averageFanOut < t.maxFanOut);
    return tier?.stability ?? profile.minStability;
  }
}
