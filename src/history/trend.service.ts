import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { buildRepoUrlVariants } from './repo-url.util';

export type TrendDirection = 'improving' | 'degrading' | 'stable';

export interface TrendPoint {
  id: string;
  analyzedAt: Date;
  overallScore: number;
  modularityScore: number;
  couplingScore: number;
  smellsScore: number;
  cycleCount: number;
  smellCount: number;
}

/** Per-metric trend directions computed independently. */
export interface MetricTrends {
  overall: TrendDirection;
  modularity: TrendDirection;
  coupling: TrendDirection;
  smells: TrendDirection;
  /** Inverted: fewer cycles = improving */
  cycles: TrendDirection;
  /** Inverted: fewer smells = improving */
  smellCount: TrendDirection;
}

export interface TrendReport {
  repoUrl: string;
  points: TrendPoint[];
  /** Overall trend direction (kept for backward compat) */
  trend: TrendDirection;
  /** Per-metric trend directions */
  metricTrends: MetricTrends;
  avgScore: number;
  bestScore: number;
  worstScore: number;
}

@Injectable()
export class TrendService {
  constructor(
    @InjectRepository(AnalysisResultEntity)
    private readonly repo: Repository<AnalysisResultEntity>,
  ) {}

  async getTrend(repoUrl: string, limit = 30): Promise<TrendReport> {
    const variants = buildRepoUrlVariants(repoUrl);

    const empty: TrendReport = {
      repoUrl,
      points: [],
      trend: 'stable',
      metricTrends: {
        overall: 'stable',
        modularity: 'stable',
        coupling: 'stable',
        smells: 'stable',
        cycles: 'stable',
        smellCount: 'stable',
      },
      avgScore: 0,
      bestScore: 0,
      worstScore: 0,
    };

    if (variants.length === 0) return empty;

    // Query DESC to get the LATEST N records, then reverse to chronological.
    // ASC + TAKE would return the OLDEST N, cutting off recent analyses.
    const records = await this.repo
      .find({
        where: { repoUrl: In(variants) },
        order: { analyzedAt: 'DESC' },
        take: limit,
        select: [
          'id',
          'analyzedAt',
          'overallScore',
          'modularityScore',
          'couplingScore',
          'smellsScore',
          'cycleCount',
          'smellCount',
        ],
      })
      .then((rows) => rows.reverse()); // → chronological (oldest first)

    if (records.length === 0) return empty;

    const scores = records.map((r) => r.overallScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Compute per-metric trends independently
    const metricTrends: MetricTrends = {
      overall: computeTrend(records.map((r) => r.overallScore)),
      modularity: computeTrend(records.map((r) => r.modularityScore)),
      coupling: computeTrend(records.map((r) => r.couplingScore)),
      smells: computeTrend(records.map((r) => r.smellsScore)),
      // Inverted metrics: fewer = better, so negate before computing trend
      cycles: computeTrend(records.map((r) => -r.cycleCount)),
      smellCount: computeTrend(records.map((r) => -r.smellCount)),
    };

    return {
      repoUrl,
      points: records.map((r) => ({
        id: r.id,
        analyzedAt: r.analyzedAt,
        overallScore: r.overallScore,
        modularityScore: r.modularityScore,
        couplingScore: r.couplingScore,
        smellsScore: r.smellsScore,
        cycleCount: r.cycleCount,
        smellCount: r.smellCount,
      })),
      trend: metricTrends.overall,
      metricTrends,
      avgScore: Number(avg.toFixed(1)),
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
    };
  }

  /**
   * Returns time-bucketed aggregated trend data.
   * Groups analyses into daily/weekly/monthly buckets and averages metrics.
   */
  async getAggregatedTrend(
    repoUrl: string,
    bucket: BucketSize = 'weekly',
    limit = 100,
  ): Promise<AggregatedTrendReport> {
    const variants = buildRepoUrlVariants(repoUrl);

    const empty: AggregatedTrendReport = {
      repoUrl,
      bucket,
      points: [],
      trend: 'stable',
    };

    if (variants.length === 0) return empty;

    const records = await this.repo
      .find({
        where: { repoUrl: In(variants) },
        order: { analyzedAt: 'DESC' },
        take: limit,
        select: [
          'id',
          'analyzedAt',
          'overallScore',
          'modularityScore',
          'couplingScore',
          'smellsScore',
          'cycleCount',
          'smellCount',
        ],
      })
      .then((rows) => rows.reverse());

    if (records.length === 0) return empty;

    // Group records into buckets
    const buckets = new Map<string, typeof records>();

    for (const r of records) {
      const key = bucketKey(r.analyzedAt, bucket);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }

    // Average each bucket
    const points: AggregatedPoint[] = [];
    for (const [key, group] of buckets) {
      const avg = (fn: (r: AnalysisResultEntity) => number) =>
        Number((group.reduce((s, r) => s + fn(r), 0) / group.length).toFixed(1));

      points.push({
        bucketStart: key,
        count: group.length,
        avgOverallScore: avg((r) => r.overallScore),
        avgModularityScore: avg((r) => r.modularityScore),
        avgCouplingScore: avg((r) => r.couplingScore),
        avgSmellsScore: avg((r) => r.smellsScore),
        avgCycleCount: avg((r) => r.cycleCount),
        avgSmellCount: avg((r) => r.smellCount),
      });
    }

    const trend = computeTrend(points.map((p) => p.avgOverallScore));

    return { repoUrl, bucket, points, trend };
  }

  /**
   * Extracts per-module smell counts from fullResult across analyses
   * and computes a trend per module.
   */
  async getModuleTrends(
    repoUrl: string,
    limit = 20,
  ): Promise<ModuleTrendReport> {
    const variants = buildRepoUrlVariants(repoUrl);
    if (variants.length === 0) {
      return { repoUrl, modules: [] };
    }

    // Need fullResult for per-module data
    const records = await this.repo
      .find({
        where: { repoUrl: In(variants) },
        order: { analyzedAt: 'DESC' },
        take: limit,
        select: ['id', 'analyzedAt', 'fullResult'],
      })
      .then((rows) => rows.reverse());

    if (records.length < 2) {
      return { repoUrl, modules: [] };
    }

    // Extract per-module smell counts across time
    const moduleTimeSeries = new Map<string, number[]>();

    for (const record of records) {
      let parsed: { smells?: Array<{ module?: string }> };
      try {
        parsed = JSON.parse(record.fullResult);
      } catch {
        continue;
      }

      // Count smells per module in this analysis
      const smellsPerModule = new Map<string, number>();
      for (const smell of parsed.smells ?? []) {
        const mod = smell.module ?? 'unknown';
        smellsPerModule.set(mod, (smellsPerModule.get(mod) ?? 0) + 1);
      }

      // Ensure all known modules get a 0 if not present in this run
      for (const mod of moduleTimeSeries.keys()) {
        if (!smellsPerModule.has(mod)) {
          moduleTimeSeries.get(mod)!.push(0);
        }
      }

      // Add this run's counts
      for (const [mod, count] of smellsPerModule) {
        if (!moduleTimeSeries.has(mod)) {
          // Backfill zeros for previous runs
          moduleTimeSeries.set(mod, Array(records.indexOf(record)).fill(0));
        }
        moduleTimeSeries.get(mod)!.push(count);
      }
    }

    // Compute trend per module
    const modules: ModuleTrend[] = [];
    for (const [mod, series] of moduleTimeSeries) {
      // Negate because fewer smells = improving
      const trend = computeTrend(series.map((v) => -v));
      const current = series.at(-1) ?? 0;
      const previous = series.at(-2) ?? 0;

      modules.push({
        module: mod,
        trend,
        currentSmellCount: current,
        previousSmellCount: previous,
        delta: current - previous,
        history: series,
      });
    }

    // Sort: degrading first, then by current smell count desc
    const order = { degrading: 0, stable: 1, improving: 2 };
    modules.sort(
      (a, b) =>
        order[a.trend] - order[b.trend] ||
        b.currentSmellCount - a.currentSmellCount,
    );

    return { repoUrl, modules };
  }
}

// ── Module-level trend types ───────────────────────────────────────────────────

export interface ModuleTrend {
  module: string;
  trend: TrendDirection;
  currentSmellCount: number;
  previousSmellCount: number;
  delta: number;
  /** Smell count per analysis run (chronological) */
  history: number[];
}

export interface ModuleTrendReport {
  repoUrl: string;
  modules: ModuleTrend[];
}

// ── Time-bucketed aggregation ──────────────────────────────────────────────────

/** Returns the bucket start date as an ISO string for grouping. */
function bucketKey(date: Date, bucket: BucketSize): string {
  const d = new Date(date);
  switch (bucket) {
    case 'daily':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    case 'weekly': {
      // Start of ISO week (Monday)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.getFullYear(), d.getMonth(), diff).toISOString();
    }
    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }
}

export type BucketSize = 'daily' | 'weekly' | 'monthly';

export interface AggregatedPoint {
  /** Bucket start date (ISO string) */
  bucketStart: string;
  /** Number of analyses in this bucket */
  count: number;
  avgOverallScore: number;
  avgModularityScore: number;
  avgCouplingScore: number;
  avgSmellsScore: number;
  avgCycleCount: number;
  avgSmellCount: number;
}

export interface AggregatedTrendReport {
  repoUrl: string;
  bucket: BucketSize;
  points: AggregatedPoint[];
  trend: TrendDirection;
}

/**
 * Theil-Sen estimator (median slope) for outlier-resistant trend detection.
 *
 * Computes consecutive slopes, takes the median:
 *   median > 1  → 'improving'
 *   median < -1 → 'degrading'
 *   else        → 'stable'
 *
 * Exported so it can be reused for any numeric series.
 */
export function computeTrend(values: number[]): TrendDirection {
  if (values.length < 3) return 'stable';

  const slopes: number[] = [];
  for (let i = 0; i < values.length - 1; i++) {
    slopes.push(values[i + 1] - values[i]);
  }
  slopes.sort((a, b) => a - b);
  const medianSlope = slopes[Math.floor(slopes.length / 2)];

  if (medianSlope > 1) return 'improving';
  if (medianSlope < -1) return 'degrading';
  return 'stable';
}
