import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { buildRepoUrlVariants } from './repo-url.util';

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

export interface TrendReport {
  repoUrl: string;
  points: TrendPoint[];
  trend: 'improving' | 'degrading' | 'stable';
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
    if (variants.length === 0) {
      return {
        repoUrl,
        points: [],
        trend: 'stable',
        avgScore: 0,
        bestScore: 0,
        worstScore: 0,
      };
    }
    const records = await this.repo.find({
      where: { repoUrl: In(variants) },
      order: { analyzedAt: 'ASC' },
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
    });

    if (records.length === 0) {
      return {
        repoUrl,
        points: [],
        trend: 'stable',
        avgScore: 0,
        bestScore: 0,
        worstScore: 0,
      };
    }

    const scores = records.map((r) => r.overallScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Linear regression slope to determine trend direction
    const trend = this.computeTrend(scores);

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
      trend,
      avgScore: Number(avg.toFixed(1)),
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
    };
  }

  /**
   * Simple linear regression — positive slope = improving, negative = degrading.
   * Uses the Theil-Sen estimator (median slope) for outlier resistance.
   */
  private computeTrend(scores: number[]): 'improving' | 'degrading' | 'stable' {
    if (scores.length < 3) return 'stable';

    const slopes: number[] = [];
    for (let i = 0; i < scores.length - 1; i++) {
      slopes.push(scores[i + 1] - scores[i]);
    }
    slopes.sort((a, b) => a - b);
    const medianSlope = slopes[Math.floor(slopes.length / 2)];

    if (medianSlope > 1) return 'improving';
    if (medianSlope < -1) return 'degrading';
    return 'stable';
  }
}
