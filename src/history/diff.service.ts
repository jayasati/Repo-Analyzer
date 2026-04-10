import { Injectable, NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';

export interface AnalysisDiff {
  from: { id: string; analyzedAt: Date; score: number };
  to: { id: string; analyzedAt: Date; score: number };
  delta: {
    overallScore: number;
    modularityScore: number;
    couplingScore: number;
    smellsScore: number;
    cycleCount: number;
    smellCount: number;
    moduleCount: number;
  };
  regression: boolean;
  newSmells: string[];
  fixedSmells: string[];
  /** Module-level changes: which modules improved/degraded */
  moduleChanges: ModuleChange[];
  /** Hotspot changes: appeared / resolved */
  hotspotChanges: HotspotChange[];
  /** Cycle changes: formed / broken */
  cycleChanges: CycleChange[];
}

export interface ModuleChange {
  module: string;
  status: 'improved' | 'degraded' | 'new' | 'removed';
  /** Smell types this module had before (empty if new) */
  smellsBefore: string[];
  /** Smell types this module has now (empty if removed) */
  smellsAfter: string[];
  /** Smells added to this module */
  addedSmells: string[];
  /** Smells removed from this module */
  removedSmells: string[];
}

export interface HotspotChange {
  module: string;
  status: 'appeared' | 'resolved' | 'worsened' | 'improved';
  fanOutBefore?: number;
  fanOutAfter?: number;
}

export interface CycleChange {
  nodes: string[];
  status: 'formed' | 'broken';
}

@Injectable()
export class DiffService {
  constructor(private readonly historyService: HistoryService) {}

  async compare(fromId: string, toId: string): Promise<AnalysisDiff> {
    const [fromEntity, toEntity] = await Promise.all([
      this.historyService.getById(fromId),
      this.historyService.getById(toId),
    ]);

    if (!fromEntity)
      throw new NotFoundException(`Analysis ${fromId} not found`);
    if (!toEntity)
      throw new NotFoundException(`Analysis ${toId} not found`);

    const fromResult = JSON.parse(fromEntity.fullResult);
    const toResult = JSON.parse(toEntity.fullResult);

    // ── Smell type diff (backward-compatible) ──────────────────────────────

    const fromSmellTypes = new Set<string>(
      (fromResult.smells ?? []).map((s: { type: string }) => s.type),
    );
    const toSmellTypes = new Set<string>(
      (toResult.smells ?? []).map((s: { type: string }) => s.type),
    );

    // ── Module-level smell diff ────────────────────────────────────────────

    const moduleChanges = this.computeModuleChanges(
      fromResult.smells ?? [],
      toResult.smells ?? [],
    );

    // ── Hotspot diff ───────────────────────────────────────────────────────

    const hotspotChanges = this.computeHotspotChanges(
      fromResult.hotspots ?? [],
      toResult.hotspots ?? [],
    );

    // ── Cycle diff ─────────────────────────────────────────────────────────

    const cycleChanges = this.computeCycleChanges(
      fromResult.cycles ?? [],
      toResult.cycles ?? [],
    );

    return {
      from: {
        id: fromId,
        analyzedAt: fromEntity.analyzedAt,
        score: fromEntity.overallScore,
      },
      to: {
        id: toId,
        analyzedAt: toEntity.analyzedAt,
        score: toEntity.overallScore,
      },
      delta: {
        overallScore: toEntity.overallScore - fromEntity.overallScore,
        modularityScore: toEntity.modularityScore - fromEntity.modularityScore,
        couplingScore: toEntity.couplingScore - fromEntity.couplingScore,
        smellsScore: toEntity.smellsScore - fromEntity.smellsScore,
        cycleCount: toEntity.cycleCount - fromEntity.cycleCount,
        smellCount: toEntity.smellCount - fromEntity.smellCount,
        moduleCount: toEntity.moduleCount - fromEntity.moduleCount,
      },
      regression: toEntity.overallScore < fromEntity.overallScore,
      newSmells: [...toSmellTypes].filter((t) => !fromSmellTypes.has(t)),
      fixedSmells: [...fromSmellTypes].filter((t) => !toSmellTypes.has(t)),
      moduleChanges,
      hotspotChanges,
      cycleChanges,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Groups smells by module and computes per-module changes.
   */
  private computeModuleChanges(
    fromSmells: Array<{ type: string; module?: string }>,
    toSmells: Array<{ type: string; module?: string }>,
  ): ModuleChange[] {
    // Group smells by module
    const fromByModule = this.groupSmellsByModule(fromSmells);
    const toByModule = this.groupSmellsByModule(toSmells);

    const allModules = new Set([
      ...fromByModule.keys(),
      ...toByModule.keys(),
    ]);

    const changes: ModuleChange[] = [];

    for (const mod of allModules) {
      const before = fromByModule.get(mod) ?? [];
      const after = toByModule.get(mod) ?? [];
      const beforeTypes = new Set(before);
      const afterTypes = new Set(after);

      const addedSmells = after.filter((t) => !beforeTypes.has(t));
      const removedSmells = before.filter((t) => !afterTypes.has(t));

      // Skip modules with no changes
      if (addedSmells.length === 0 && removedSmells.length === 0) continue;

      let status: ModuleChange['status'];
      if (before.length === 0) {
        status = 'new'; // module didn't have smells before, now it does
      } else if (after.length === 0) {
        status = 'removed'; // module had smells, now clean
      } else if (addedSmells.length > removedSmells.length) {
        status = 'degraded';
      } else {
        status = 'improved';
      }

      changes.push({
        module: mod,
        status,
        smellsBefore: before,
        smellsAfter: after,
        addedSmells,
        removedSmells,
      });
    }

    // Sort: degraded first, then new, then improved, then removed
    const order = { degraded: 0, new: 1, improved: 2, removed: 3 };
    changes.sort((a, b) => order[a.status] - order[b.status]);

    return changes;
  }

  private groupSmellsByModule(
    smells: Array<{ type: string; module?: string }>,
  ): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const smell of smells) {
      const mod = smell.module ?? 'unknown';
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(smell.type);
    }
    return map;
  }

  /**
   * Compares hotspot lists to find appeared/resolved/worsened/improved.
   */
  private computeHotspotChanges(
    fromHotspots: Array<{ module: string; fanOut: number }>,
    toHotspots: Array<{ module: string; fanOut: number }>,
  ): HotspotChange[] {
    const fromMap = new Map(fromHotspots.map((h) => [h.module, h.fanOut]));
    const toMap = new Map(toHotspots.map((h) => [h.module, h.fanOut]));

    const allModules = new Set([...fromMap.keys(), ...toMap.keys()]);
    const changes: HotspotChange[] = [];

    for (const mod of allModules) {
      const before = fromMap.get(mod);
      const after = toMap.get(mod);

      if (before === undefined && after !== undefined) {
        changes.push({ module: mod, status: 'appeared', fanOutAfter: after });
      } else if (before !== undefined && after === undefined) {
        changes.push({ module: mod, status: 'resolved', fanOutBefore: before });
      } else if (before !== undefined && after !== undefined) {
        if (after > before) {
          changes.push({
            module: mod,
            status: 'worsened',
            fanOutBefore: before,
            fanOutAfter: after,
          });
        } else if (after < before) {
          changes.push({
            module: mod,
            status: 'improved',
            fanOutBefore: before,
            fanOutAfter: after,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Compares cycle lists to find formed/broken cycles.
   * Uses sorted node string as key for comparison.
   */
  private computeCycleChanges(
    fromCycles: Array<{ nodes: string[] }>,
    toCycles: Array<{ nodes: string[] }>,
  ): CycleChange[] {
    const cycleKey = (nodes: string[]) => [...nodes].sort().join(' → ');

    const fromKeys = new Set(fromCycles.map((c) => cycleKey(c.nodes)));
    const toKeys = new Set(toCycles.map((c) => cycleKey(c.nodes)));

    const changes: CycleChange[] = [];

    // New cycles (formed)
    for (const c of toCycles) {
      const key = cycleKey(c.nodes);
      if (!fromKeys.has(key)) {
        changes.push({ nodes: c.nodes, status: 'formed' });
      }
    }

    // Broken cycles (resolved)
    for (const c of fromCycles) {
      const key = cycleKey(c.nodes);
      if (!toKeys.has(key)) {
        changes.push({ nodes: c.nodes, status: 'broken' });
      }
    }

    return changes;
  }
}
