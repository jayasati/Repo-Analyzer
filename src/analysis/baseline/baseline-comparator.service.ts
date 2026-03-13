import { Injectable } from '@nestjs/common';

import { ArchitectureMetrics } from '../metrics/architecture-metrics.types';
import { BASELINES }           from './baseline-dataset';
import { BaselineComparison }  from './baseline.types';

@Injectable()
export class BaselineComparatorService {

  compare(metrics: ArchitectureMetrics): BaselineComparison[] {
    return BASELINES
      .map(baseline => ({
        name:       baseline.name,
        similarity: Number(
          this.computeSimilarity(metrics, baseline.metrics).toFixed(2),
        ),
      }))
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Computes a similarity score in [0, 1] between two metric objects.
   *
   * Algorithm: for each metric key, compute the normalised absolute difference
   * between the subject and the baseline value (capped at 1 per key so that
   * extreme outliers don't dominate). The average of those differences is
   * subtracted from 1 to produce a similarity score.
   */
  private computeSimilarity(
    subject:  ArchitectureMetrics,
    baseline: ArchitectureMetrics,
  ): number {
    const metricKeys = Object.keys(subject) as (keyof ArchitectureMetrics)[];

    const totalNormalisedDifference = metricKeys.reduce((sum, key) => {
      const subjectValue  = subject[key];
      const baselineValue = baseline[key];
      const normalisedDelta =
        Math.abs(subjectValue - baselineValue) /
        (Math.max(subjectValue, baselineValue) || 1);
      return sum + normalisedDelta;
    }, 0);

    const averageDifference = totalNormalisedDifference / metricKeys.length;
    return Math.max(0, 1 - averageDifference);
  }
}