import { Injectable } from '@nestjs/common';

import { ArchitectureScore } from '../scoring/architecture-score.types';
import { ArchitectureSmell } from '../smells/smell.types';
import { ArchitectureHealth } from './architecture-health.types';

@Injectable()
export class ArchitectureHealthService {

  /**
   * Minimum score (0–100) a dimension must reach to be considered healthy.
   * Adjust here to tune the health classification globally.
   */
  private static readonly HEALTH_THRESHOLD = 70;

  generate(
    score:  ArchitectureScore,
    smells: ArchitectureSmell[],
  ): ArchitectureHealth {
    const { HEALTH_THRESHOLD } = ArchitectureHealthService;
    const strengths:  string[] = [];
    const weaknesses: string[] = [];

    if (score.breakdown.modularity > HEALTH_THRESHOLD) {
      strengths.push('High modularity');
    } else {
      weaknesses.push('Low modularity');
    }

    if (score.breakdown.coupling > HEALTH_THRESHOLD) {
      strengths.push('Low coupling');
    } else {
      weaknesses.push('High coupling between modules');
    }

    if (smells.length === 0) {
      strengths.push('No major architecture smells detected');
    } else {
      weaknesses.push(`${smells.length} architecture smells detected`);
    }

    return { score: score.overall, strengths, weaknesses };
  }
}