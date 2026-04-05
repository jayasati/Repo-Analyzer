import { Injectable } from '@nestjs/common';
import { ArchitectureSmell } from './smell.types';
import { GraphStats, computeGraphStats } from '../utils/graph-stats';
import type { DetectedFramework } from '../../detection/detection-result.type';
import { UnifiedGraph } from '../../graph/unified-graph.types';

interface SmellThresholds {
  godModule:           number;
  hubDependency:       number;
  godFile:             number;
  deepHierarchy:       number;
  instabilityThreshold: number;
}

const FRAMEWORK_THRESHOLDS: Readonly<Record<string, SmellThresholds>> = {
  nestjs:    { godModule: 8,  hubDependency: 6, godFile: 20, deepHierarchy: 6, instabilityThreshold: 0.8 },
  angular:   { godModule: 10, hubDependency: 7, godFile: 25, deepHierarchy: 7, instabilityThreshold: 0.8 },
  spring:    { godModule: 8,  hubDependency: 6, godFile: 20, deepHierarchy: 6, instabilityThreshold: 0.8 },
  aspnet:    { godModule: 8,  hubDependency: 6, godFile: 20, deepHierarchy: 6, instabilityThreshold: 0.8 },
  symfony:   { godModule: 8,  hubDependency: 6, godFile: 20, deepHierarchy: 6, instabilityThreshold: 0.8 },
  laravel:   { godModule: 7,  hubDependency: 5, godFile: 18, deepHierarchy: 5, instabilityThreshold: 0.75 },
  rails:     { godModule: 7,  hubDependency: 5, godFile: 18, deepHierarchy: 5, instabilityThreshold: 0.75 },
  django:    { godModule: 6,  hubDependency: 5, godFile: 15, deepHierarchy: 5, instabilityThreshold: 0.75 },
  nextjs:    { godModule: 6,  hubDependency: 5, godFile: 15, deepHierarchy: 5, instabilityThreshold: 0.75 },
  express:   { godModule: 5,  hubDependency: 4, godFile: 12, deepHierarchy: 4, instabilityThreshold: 0.70 },
  fastapi:   { godModule: 5,  hubDependency: 4, godFile: 12, deepHierarchy: 4, instabilityThreshold: 0.70 },
  flask:     { godModule: 5,  hubDependency: 4, godFile: 12, deepHierarchy: 4, instabilityThreshold: 0.70 },
  gin:       { godModule: 4,  hubDependency: 4, godFile: 10, deepHierarchy: 4, instabilityThreshold: 0.65 },
  actix:     { godModule: 4,  hubDependency: 4, godFile: 10, deepHierarchy: 4, instabilityThreshold: 0.65 },
  flutter:   { godModule: 4,  hubDependency: 4, godFile: 10, deepHierarchy: 4, instabilityThreshold: 0.65 },
};

const DEFAULT_THRESHOLDS: SmellThresholds = {
  godModule:            6,
  hubDependency:        5,
  godFile:              15,
  deepHierarchy:        5,
  instabilityThreshold: 0.75,
};

@Injectable()
export class SmellDetectorService {

  /**
   * Detect all architecture smells.
   *
   * @param packageEdges  Package-level directed edges
   * @param framework     Detected framework — calibrates thresholds
   * @param graph         Full unified graph — needed for file-level smells
   */
  detect(
    packageEdges: { from: string; to: string }[],
    framework?:   DetectedFramework,
    graph?:       UnifiedGraph,
  ): ArchitectureSmell[] {
    const stats      = computeGraphStats(packageEdges);
    const thresholds = this.resolveThresholds(framework);

    return [
      ...this.detectGodModules(stats.fanOut, thresholds.godModule),
      ...this.detectHubDependencies(stats.fanIn, thresholds.hubDependency),
      ...this.detectDeadModules(stats),
      ...this.detectPackageTangles(packageEdges),
      ...this.detectUnstableAbstractions(stats, thresholds.instabilityThreshold),
      ...this.detectDeepHierarchy(packageEdges, thresholds.deepHierarchy),
      ...this.detectGodFiles(graph, thresholds.godFile),
      ...this.detectScatteredFunctionality(packageEdges),
    ];
  }

  // ── God module ────────────────────────────────────────────────────────────

  private detectGodModules(
    fanOut:    Map<string, number>,
    threshold: number,
  ): ArchitectureSmell[] {
    return Array.from(fanOut.entries())
      .filter(([, count]) => count >= threshold)
      .map(([module, count]) => ({
        type:     'god-module'  as const,
        message:  `${module} has too many outgoing dependencies (${count}) — it knows too much about the rest of the system`,
        severity: count >= threshold * 1.5 ? 'high' as const : 'medium' as const,
        module,
        details:  { fanOut: count, threshold },
      }));
  }

  // ── Hub dependency ────────────────────────────────────────────────────────

  private detectHubDependencies(
    fanIn:     Map<string, number>,
    threshold: number,
  ): ArchitectureSmell[] {
    return Array.from(fanIn.entries())
      .filter(([, count]) => count >= threshold)
      .map(([module, count]) => ({
        type:     'hub-dependency' as const,
        message:  `${module} is imported by ${count} modules — a change here has wide blast radius`,
        severity: 'medium' as const,
        module,
        details:  { fanIn: count, threshold },
      }));
  }

  // ── Dead module ───────────────────────────────────────────────────────────

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
        message:  `${module} has no incoming or outgoing dependencies — it may be unused or orphaned`,
        severity: 'low' as const,
        module,
      }));
  }

  // ── Package tangle (bidirectional dependency) ─────────────────────────────

  private detectPackageTangles(
    edges: { from: string; to: string }[],
  ): ArchitectureSmell[] {
    const smells: ArchitectureSmell[] = [];
    const edgeSet = new Set(edges.map(e => `${e.from}->${e.to}`));
    const reported = new Set<string>();

    for (const { from, to } of edges) {
      if (from === to) continue; // self-loop at package level — not a tangle

      const reverseKey = `${to}->${from}`;
      const pairKey    = [from, to].sort().join('<->');

      if (edgeSet.has(reverseKey) && !reported.has(pairKey)) {
        reported.add(pairKey);
        smells.push({
          type:     'package-tangle' as const,
          message:  `${from} and ${to} depend on each other — this bidirectional coupling prevents either from being tested or deployed independently`,
          severity: 'high' as const,
          module:   from,
          details:  { tangled: [from, to] },
        });
      }
    }
    return smells;
  }

  // ── Unstable abstraction ──────────────────────────────────────────────────
  //
  // Martin's Instability metric: I = fanOut / (fanIn + fanOut)
  // A module with high instability (close to 1) that many others depend on
  // is dangerous — it changes frequently but has high impact.

  private detectUnstableAbstractions(
    stats:     GraphStats,
    threshold: number,
  ): ArchitectureSmell[] {
    const smells: ArchitectureSmell[] = [];

    stats.modules.forEach(module => {
      const fanIn  = stats.fanIn.get(module)  ?? 0;
      const fanOut = stats.fanOut.get(module) ?? 0;
      const total  = fanIn + fanOut;
      if (total === 0) return;

      const instability = fanOut / total;
      // Only flag if the module is heavily depended on AND unstable
      if (instability >= threshold && fanIn >= 3) {
        smells.push({
          type:     'unstable-abstraction' as const,
          message:  `${module} has high instability (${instability.toFixed(2)}) but ${fanIn} dependents — changes will cascade widely`,
          severity: instability >= 0.9 ? 'high' as const : 'medium' as const,
          module,
          details:  { instability: Number(instability.toFixed(2)), fanIn, fanOut },
        });
      }
    });

    return smells;
  }

  // ── Deep hierarchy ────────────────────────────────────────────────────────
  //
  // Find the longest dependency chain (critical path).
  // Chains longer than threshold indicate excessive layering.

  private detectDeepHierarchy(
    edges:     { from: string; to: string }[],
    threshold: number,
  ): ArchitectureSmell[] {
    const graph = new Map<string, string[]>();
    const allNodes = new Set<string>();

    for (const { from, to } of edges) {
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from)!.push(to);
      allNodes.add(from);
      allNodes.add(to);
    }

    // DFS longest path (DAG — cycles already reported separately)
    const memo = new Map<string, number>();
    const depth = (node: string, visited = new Set<string>()): number => {
      if (memo.has(node)) return memo.get(node)!;
      if (visited.has(node)) return 0; // cycle guard
      visited.add(node);

      const children = graph.get(node) ?? [];
      const maxChild = children.reduce(
        (max, child) => Math.max(max, depth(child, new Set(visited))),
        0,
      );
      const result = maxChild + 1;
      memo.set(node, result);
      return result;
    };

    const smells: ArchitectureSmell[] = [];
    allNodes.forEach(node => {
      const d = depth(node);
      if (d > threshold) {
        smells.push({
          type:     'deep-hierarchy' as const,
          message:  `Dependency chain starting at ${node} is ${d} levels deep — consider flattening the architecture`,
          severity: d > threshold * 1.5 ? 'high' as const : 'medium' as const,
          module:   node,
          details:  { depth: d, threshold },
        });
      }
    });

    // Only report the single deepest chain, not every intermediate node
    if (smells.length === 0) return [];
    smells.sort((a, b) => (b.details!['depth'] as number) - (a.details!['depth'] as number));
    return [smells[0]];
  }

  // ── God file (file-level, not package-level) ──────────────────────────────

  private detectGodFiles(
    graph?:    UnifiedGraph,
    threshold: number = 15,
  ): ArchitectureSmell[] {
    if (!graph) return [];
    const smells: ArchitectureSmell[] = [];

    // Count outgoing import edges per file node
    const fileFanOut = new Map<string, number>();
    for (const edge of graph.edges) {
      if (edge.type !== 'import') continue;
      fileFanOut.set(edge.from, (fileFanOut.get(edge.from) ?? 0) + 1);
    }

    fileFanOut.forEach((count, filePath) => {
      if (count >= threshold) {
        // Extract just the filename for the message
        const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
        smells.push({
          type:     'god-file' as const,
          message:  `${fileName} imports ${count} other files — it likely handles too many concerns`,
          severity: count >= threshold * 1.5 ? 'high' as const : 'medium' as const,
          module:   fileName,
          details:  { filePath, importCount: count, threshold },
        });
      }
    });

    return smells;
  }

  // ── Scattered functionality ───────────────────────────────────────────────
  //
  // Detects when multiple modules share a name prefix but all depend on
  // each other — suggesting a concept that should be one module was split.
  // e.g. user-profile, user-settings, user-auth all import each other.

  private detectScatteredFunctionality(
    edges: { from: string; to: string }[],
  ): ArchitectureSmell[] {
    const smells: ArchitectureSmell[] = [];

    // Group modules by common prefix (first word before - or _)
    const groups = new Map<string, Set<string>>();
    const allModules = new Set([...edges.map(e => e.from), ...edges.map(e => e.to)]);

    allModules.forEach(m => {
      const prefix = m.split(/[-_]/)[0];
      if (!groups.has(prefix)) groups.set(prefix, new Set());
      groups.get(prefix)!.add(m);
    });

    const edgeSet = new Set(edges.map(e => `${e.from}->${e.to}`));

    groups.forEach((members, prefix) => {
      if (members.size < 3) return; // need at least 3 to be "scattered"

      const memberArr = Array.from(members);
      let internalEdges = 0;
      for (let i = 0; i < memberArr.length; i++) {
        for (let j = 0; j < memberArr.length; j++) {
          if (i !== j && edgeSet.has(`${memberArr[i]}->${memberArr[j]}`)) {
            internalEdges++;
          }
        }
      }

      // If >half of all possible internal edges exist, it's scattered
      const maxEdges = members.size * (members.size - 1);
      if (internalEdges > maxEdges * 0.5) {
        smells.push({
          type:     'scattered-functionality' as const,
          message:  `${members.size} modules share the "${prefix}" prefix and heavily depend on each other — consider consolidating into a single module`,
          severity: 'low' as const,
          module:   prefix,
          details:  { modules: memberArr, internalEdges },
        });
      }
    });

    return smells;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private computeEntryModules(stats: GraphStats): Set<string> {
    const entries = new Set<string>();
    stats.fanOut.forEach((count, module) => {
      if ((stats.fanIn.get(module) ?? 0) === 0 && count > 0) {
        entries.add(module);
      }
    });
    return entries;
  }

  private resolveThresholds(framework?: DetectedFramework): SmellThresholds {
    if (!framework) return DEFAULT_THRESHOLDS;
    return FRAMEWORK_THRESHOLDS[framework] ?? DEFAULT_THRESHOLDS;
  }
}