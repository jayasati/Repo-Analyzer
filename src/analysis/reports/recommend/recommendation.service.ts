import { ArchitectureSmell } from '../../smells/smell.types';
import { ArchitectureRecommendation } from './recommendation.types';

export class RecommendationService {
  generate(
    smells: ArchitectureSmell[],
    cycles: { nodes: string[] }[],
    score: number,
  ): ArchitectureRecommendation[] {
    const recommendations: ArchitectureRecommendation[] = [];

    // Handle circular dependencies
    cycles.forEach((cycle) => {
      recommendations.push({
        message: `Break circular dependency: ${cycle.nodes.join(' → ')}`,
        severity: 'high',
      });
    });

    // Handle smells
    smells.forEach((smell) => {
      if (smell.type === 'god-module') {
        recommendations.push({
          message: `Reduce dependencies in ${smell.module} (God Module detected)`,
          severity: 'high',
        });
      }

      if (smell.type === 'hub-dependency') {
        recommendations.push({
          message: `Many modules depend on ${smell.module}. Consider introducing interfaces or abstraction.`,
          severity: 'medium',
        });
      }

      if (smell.type === 'dead-module') {
        recommendations.push({
          message: `${smell.module} appears unused. Consider removing it.`,
          severity: 'low',
        });
      }
    });

    // Global architecture suggestion
    if (score < 60) {
      recommendations.push({
        message:
          'Architecture score is low. Consider reducing module coupling.',
        severity: 'high',
      });
    }

    return recommendations;
  }
}
