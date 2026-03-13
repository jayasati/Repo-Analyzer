import { Injectable } from '@nestjs/common';

import { ArchitectureSmell } from './smell.types';
import { GraphStats, computeGraphStats } from '../utils/graph-stats';

@Injectable()
export class SmellDetectorService {

  // ─── Detection thresholds ────────────────────────────────────────────────

  private static readonly GOD_MODULE_THRESHOLD    = 6;
  private static readonly HUB_DEPENDENCY_THRESHOLD = 6;

  // ─── Public API ──────────────────────────────────────────────────────────

  detect(packageEdges: { from: string; to: string }[]): ArchitectureSmell[] {
    const stats = computeGraphStats(packageEdges);

    return [
      ...this.detectGodModules(stats.fanOut),
      ...this.detectHubDependencies(stats.fanIn),
      ...this.detectDeadModules(stats),
    ];
  }

  // ─── Private detection helpers ───────────────────────────────────────────

  private detectGodModules(fanOut: Map<string, number>): ArchitectureSmell[] {
    return Array.from(fanOut.entries())
      .filter(([, count]) => count >= SmellDetectorService.GOD_MODULE_THRESHOLD)
      .map(([module, count]) => ({
        type:     'god-module'  as const,
        message:  `${module} depends on too many modules (${count})`,
        severity: 'high'        as const,
        module,
      }));
  }

  private detectHubDependencies(fanIn: Map<string, number>): ArchitectureSmell[] {
    return Array.from(fanIn.entries())
      .filter(([, count]) => count >= SmellDetectorService.HUB_DEPENDENCY_THRESHOLD)
      .map(([module, count]) => ({
        type:     'hub-dependency' as const,
        message:  `${module} is depended on by many modules (${count})`,
        severity: 'medium'         as const,
        module,
      }));
  }

  private detectDeadModules(stats: GraphStats): ArchitectureSmell[] {
    const entryModules = this.computeEntryModules(stats);

    return Array.from(stats.modules)
      .filter(module => {
        const hasNoIncoming = (stats.fanIn.get(module)  ?? 0) === 0;
        const hasNoOutgoing = (stats.fanOut.get(module) ?? 0) === 0;
        return hasNoIncoming && hasNoOutgoing && !entryModules.has(module);
      })
      .map(module => ({
        type:     'dead-module' as const,
        message:  `${module} appears unused`,
        severity: 'low'         as const,
        module,
      }));
  }

  /**
   * Entry modules have outgoing edges but no incoming edges — they are roots
   * of the dependency graph and should never be flagged as dead modules.
   */
  private computeEntryModules(stats: GraphStats): Set<string> {
    const entries = new Set<string>();

    stats.fanOut.forEach((count, module) => {
      const hasNoIncoming = (stats.fanIn.get(module) ?? 0) === 0;
      if (hasNoIncoming && count > 0) {
        entries.add(module);
      }
    });

    return entries;
  }
}