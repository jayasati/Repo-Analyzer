import { ArchitectureMetrics } from './architecture-metrics.types';
import { computeGraphStats } from '../utils/graph-stats';

import { Injectable } from '@nestjs/common';

@Injectable()
export class ArchitectureMetricsService {
  compute(
    edges: { from: string; to: string }[],
    cycles: { nodes: string[] }[],
  ): ArchitectureMetrics {
    const stats = computeGraphStats(edges);

    const fanIn = stats.fanIn;
    const fanOut = stats.fanOut;
    const modules = stats.modules;

    const avgFanIn =
      Array.from(fanIn.values()).reduce((a, b) => a + b, 0) / (fanIn.size || 1);

    const avgFanOut =
      Array.from(fanOut.values()).reduce((a, b) => a + b, 0) /
      (fanOut.size || 1);

    const fanOutValues = Array.from(fanOut.values());
    const maxFanOut = fanOutValues.length ? Math.max(...fanOutValues) : 0;

    const moduleCount = modules.size;
    const dependencyCount = edges.length;

    const maxPossibleDependencies =
      moduleCount > 1 ? moduleCount * (moduleCount - 1) : 1;

    const dependencyDensity =
      moduleCount > 1 ? dependencyCount / maxPossibleDependencies : 0;

    return {
      moduleCount,
      dependencyCount,
      cycleCount: cycles.length,
      averageFanIn: Number(avgFanIn.toFixed(2)),
      averageFanOut: Number(avgFanOut.toFixed(2)),
      dependencyDensity: Number(dependencyDensity.toFixed(3)),
      maxFanOut,
    };
  }
}
