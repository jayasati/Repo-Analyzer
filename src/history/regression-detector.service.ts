import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { buildRepoUrlVariants } from './repo-url.util';

export interface RegressionAlert {
  repoUrl: string;
  projectName: string;
  /** Current analysis ID */
  currentId: string;
  /** Previous analysis ID */
  previousId: string;
  analyzedAt: Date;
  /** Which metrics regressed */
  regressions: MetricRegression[];
  /** Overall severity: worst individual regression severity */
  severity: 'warning' | 'critical';
}

export interface MetricRegression {
  metric: string;
  previous: number;
  current: number;
  delta: number;
  severity: 'warning' | 'critical';
}

/** Configurable thresholds for regression detection */
export interface RegressionThresholds {
  /** Score drop that triggers a warning (default: 5) */
  scoreWarning: number;
  /** Score drop that triggers a critical alert (default: 15) */
  scoreCritical: number;
  /** Smell count increase that triggers a warning (default: 2) */
  smellCountWarning: number;
  /** Smell count increase that triggers critical (default: 5) */
  smellCountCritical: number;
  /** Cycle count increase that triggers a warning (default: 1) */
  cycleCountWarning: number;
  /** Cycle count increase that triggers critical (default: 3) */
  cycleCountCritical: number;
}

const DEFAULT_THRESHOLDS: RegressionThresholds = {
  scoreWarning: 5,
  scoreCritical: 15,
  smellCountWarning: 2,
  smellCountCritical: 5,
  cycleCountWarning: 1,
  cycleCountCritical: 3,
};

@Injectable()
export class RegressionDetectorService {
  constructor(
    @InjectRepository(AnalysisResultEntity)
    private readonly repo: Repository<AnalysisResultEntity>,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * Compares the latest analysis against its predecessor for a repo.
   * If significant regressions are detected, emits 'analysis.regression'.
   *
   * Called by HistoryService.save() after persisting a new result.
   */
  async checkForRegression(
    repoUrl: string,
    currentEntity: AnalysisResultEntity,
    thresholds: RegressionThresholds = DEFAULT_THRESHOLDS,
  ): Promise<RegressionAlert | null> {
    // Fetch the previous analysis (second most recent)
    const variants = buildRepoUrlVariants(repoUrl);
    if (variants.length === 0) return null;

    const previous = await this.repo.find({
      where: { repoUrl: In(variants) },
      order: { analyzedAt: 'DESC' },
      take: 2,
      select: [
        'id',
        'overallScore',
        'modularityScore',
        'couplingScore',
        'smellsScore',
        'cycleCount',
        'smellCount',
      ],
    });

    // Need at least 2 records (current + previous)
    if (previous.length < 2) return null;

    // The first record is the current one (just saved), second is the predecessor
    const prev = previous[1];
    const curr = currentEntity;

    const regressions: MetricRegression[] = [];

    // Check each metric for regression
    this.checkMetric(
      regressions,
      'Overall Score',
      prev.overallScore,
      curr.overallScore,
      thresholds.scoreWarning,
      thresholds.scoreCritical,
      false, // lower is worse
    );

    this.checkMetric(
      regressions,
      'Modularity Score',
      prev.modularityScore,
      curr.modularityScore,
      thresholds.scoreWarning,
      thresholds.scoreCritical,
      false,
    );

    this.checkMetric(
      regressions,
      'Coupling Score',
      prev.couplingScore,
      curr.couplingScore,
      thresholds.scoreWarning,
      thresholds.scoreCritical,
      false,
    );

    this.checkMetric(
      regressions,
      'Smell Count',
      prev.smellCount,
      curr.smellCount,
      thresholds.smellCountWarning,
      thresholds.smellCountCritical,
      true, // higher is worse
    );

    this.checkMetric(
      regressions,
      'Cycle Count',
      prev.cycleCount,
      curr.cycleCount,
      thresholds.cycleCountWarning,
      thresholds.cycleCountCritical,
      true,
    );

    if (regressions.length === 0) return null;

    const severity = regressions.some((r) => r.severity === 'critical')
      ? 'critical'
      : 'warning';

    const alert: RegressionAlert = {
      repoUrl,
      projectName: curr.projectName,
      currentId: curr.id,
      previousId: prev.id,
      analyzedAt: curr.analyzedAt,
      regressions,
      severity,
    };

    // Emit event for notification system to pick up
    this.emitter.emit('analysis.regression', alert);

    return alert;
  }

  private checkMetric(
    regressions: MetricRegression[],
    metric: string,
    previous: number,
    current: number,
    warningThreshold: number,
    criticalThreshold: number,
    higherIsWorse: boolean,
  ): void {
    const delta = current - previous;
    const absDelta = Math.abs(delta);

    // Determine if this is a regression
    const isRegression = higherIsWorse ? delta > 0 : delta < 0;
    if (!isRegression) return;

    if (absDelta >= criticalThreshold) {
      regressions.push({ metric, previous, current, delta, severity: 'critical' });
    } else if (absDelta >= warningThreshold) {
      regressions.push({ metric, previous, current, delta, severity: 'warning' });
    }
  }
}
