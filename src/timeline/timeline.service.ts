// ── src/timeline/timeline.service.ts ─────────────────────────────────────────
//
// Time Travel Architecture:
//   See your system 3 months ago, today, and where it's heading.
//   Compares graph snapshots across history records for visual diff.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalysisResultEntity } from '../persistence/entities/analysis-result.entity';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleDelta {
  module: string;
  /** null = module did not exist in this snapshot */
  scoreBefore: number | null;
  scoreAfter: number | null;
  smellsBefore: string[];
  smellsAfter: string[];
  /** Newly introduced smells */
  introduced: string[];
  /** Smells that were fixed */
  resolved: string[];
  riskChange:
    | 'improved'
    | 'degraded'
    | 'unchanged'
    | 'appeared'
    | 'disappeared';
}

export interface GraphDiff {
  /** Modules added between the two snapshots */
  addedModules: string[];
  /** Modules removed between the two snapshots */
  removedModules: string[];
  /** New dependency edges */
  addedEdges: Array<{ from: string; to: string }>;
  /** Removed dependency edges */
  removedEdges: Array<{ from: string; to: string }>;
  /** Modules that changed smell profile */
  changedModules: ModuleDelta[];
}

export interface TimelinePoint {
  id: string;
  analyzedAt: Date;
  overallScore: number;
  cycleCount: number;
  smellCount: number;
  moduleCount: number;
  label: string; // "3 months ago", "2 weeks ago", "today" etc.
}

export interface TimelineReport {
  repoUrl: string;
  points: TimelinePoint[];
  /** Trajectory: regression/stable/improving */
  trajectory: 'improving' | 'degrading' | 'stable';
  /** Diff between first and last snapshot */
  totalDiff: GraphDiff;
  /** Predicted score 4 weeks out based on linear trend */
  projectedScore?: number;
  /** PlantUML for the "then vs now" component diff */
  diffDiagram?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class TimelineService {
  constructor(
    @InjectRepository(AnalysisResultEntity)
    private readonly repo: Repository<AnalysisResultEntity>,
  ) {}

  async getTimeline(repoUrl: string, limit = 20): Promise<TimelineReport> {
    const records = await this.repo.find({
      where: { repoUrl },
      order: { analyzedAt: 'ASC' },
      take: limit,
    });

    if (records.length === 0) {
      return {
        repoUrl,
        points: [],
        trajectory: 'stable',
        totalDiff: this.emptyDiff(),
      };
    }

    const now = new Date();
    const points: TimelinePoint[] = records.map((r) => ({
      id: r.id,
      analyzedAt: r.analyzedAt,
      overallScore: r.overallScore,
      cycleCount: r.cycleCount,
      smellCount: r.smellCount,
      moduleCount: r.moduleCount,
      label: this.relativeLabel(r.analyzedAt, now),
    }));

    const scores = points.map((p) => p.overallScore);
    const trajectory = this.computeTrajectory(scores);
    const projected = this.projectScore(scores);

    // Full graph diff between earliest and latest snapshots
    const first = JSON.parse(records[0].fullResult) as PipelineResult;
    const last = JSON.parse(
      records[records.length - 1].fullResult,
    ) as PipelineResult;
    const totalDiff = this.buildGraphDiff(first, last);
    const diffDiagram = this.renderDiffDiagram(first, last, totalDiff);

    return {
      repoUrl,
      points,
      trajectory,
      totalDiff,
      projectedScore: projected,
      diffDiagram,
    };
  }

  /**
   * Returns a point-in-time diff between any two analysis records.
   * Used for the PR comparison view: "this branch vs main".
   */
  async compareSnapshots(
    fromId: string,
    toId: string,
  ): Promise<GraphDiff & { summary: string }> {
    const [fromRecord, toRecord] = await Promise.all([
      this.repo.findOneBy({ id: fromId }),
      this.repo.findOneBy({ id: toId }),
    ]);
    if (!fromRecord || !toRecord) throw new Error('Snapshot not found');

    const from = JSON.parse(fromRecord.fullResult) as PipelineResult;
    const to = JSON.parse(toRecord.fullResult) as PipelineResult;
    const diff = this.buildGraphDiff(from, to);

    const scoreDelta = toRecord.overallScore - fromRecord.overallScore;
    const summary =
      `Score ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} (${fromRecord.overallScore} → ${toRecord.overallScore}). ` +
      `${diff.addedModules.length} new module(s), ${diff.removedModules.length} removed. ` +
      `${diff.addedEdges.length} new deps, ${diff.removedEdges.length} removed deps.`;

    return { ...diff, summary };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildGraphDiff(
    before: PipelineResult,
    after: PipelineResult,
  ): GraphDiff {
    // Extract module sets
    const modsBefore = new Set(before.hotspots.map((h) => h.module));
    const modsAfter = new Set(after.hotspots.map((h) => h.module));

    const addedModules = [...modsAfter].filter((m) => !modsBefore.has(m));
    const removedModules = [...modsBefore].filter((m) => !modsAfter.has(m));

    // Extract edge sets from smells (package-tangle smells carry edges)
    const edgesBefore = this.extractEdges(before);
    const edgesAfter = this.extractEdges(after);

    const edgeKey = (e: { from: string; to: string }) => `${e.from}→${e.to}`;
    const keysBefore = new Set(edgesBefore.map(edgeKey));
    const keysAfter = new Set(edgesAfter.map(edgeKey));

    const addedEdges = edgesAfter.filter((e) => !keysBefore.has(edgeKey(e)));
    const removedEdges = edgesBefore.filter((e) => !keysAfter.has(edgeKey(e)));

    // Module-level smell deltas
    const smellsBefore = new Map<string, string[]>();
    const smellsAfter = new Map<string, string[]>();

    for (const s of before.smells)
      if (s.module) {
        smellsBefore.set(s.module, [
          ...(smellsBefore.get(s.module) ?? []),
          s.type,
        ]);
      }
    for (const s of after.smells)
      if (s.module) {
        smellsAfter.set(s.module, [
          ...(smellsAfter.get(s.module) ?? []),
          s.type,
        ]);
      }

    const allModules = new Set([...smellsBefore.keys(), ...smellsAfter.keys()]);
    const changedModules: ModuleDelta[] = [];

    for (const module of allModules) {
      const before_ = smellsBefore.get(module) ?? [];
      const after_ = smellsAfter.get(module) ?? [];
      const introduced = after_.filter((t) => !before_.includes(t));
      const resolved = before_.filter((t) => !after_.includes(t));

      if (
        introduced.length > 0 ||
        resolved.length > 0 ||
        !modsBefore.has(module) ||
        !modsAfter.has(module)
      ) {
        changedModules.push({
          module,
          scoreBefore: modsBefore.has(module) ? before.score.overall : null,
          scoreAfter: modsAfter.has(module) ? after.score.overall : null,
          smellsBefore: before_,
          smellsAfter: after_,
          introduced,
          resolved,
          riskChange: this.toRiskChange(
            before_,
            after_,
            modsBefore.has(module),
            modsAfter.has(module),
          ),
        });
      }
    }

    return {
      addedModules,
      removedModules,
      addedEdges,
      removedEdges,
      changedModules,
    };
  }

  private extractEdges(
    result: PipelineResult,
  ): Array<{ from: string; to: string }> {
    return result.smells
      .filter((s) => s.type === 'package-tangle' && s.details?.tangled)
      .flatMap((s) => {
        const [a, b] = s.details!.tangled as string[];
        return [{ from: a, to: b }];
      });
  }

  private toRiskChange(
    before: string[],
    after: string[],
    existedBefore: boolean,
    existsAfter: boolean,
  ): ModuleDelta['riskChange'] {
    if (!existedBefore) return 'appeared';
    if (!existsAfter) return 'disappeared';
    if (after.length < before.length) return 'improved';
    if (after.length > before.length) return 'degraded';
    return 'unchanged';
  }

  private computeTrajectory(
    scores: number[],
  ): 'improving' | 'degrading' | 'stable' {
    if (scores.length < 2) return 'stable';
    const slopes = scores.slice(1).map((s, i) => s - scores[i]);
    const median = slopes.sort((a, b) => a - b)[Math.floor(slopes.length / 2)];
    if (median > 1) return 'improving';
    if (median < -1) return 'degrading';
    return 'stable';
  }

  private projectScore(scores: number[]): number | undefined {
    if (scores.length < 3) return undefined;
    // Simple linear regression projection (4 weeks ≈ 4 data points forward)
    const n = scores.length;
    const xs = scores.map((_, i) => i);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * scores[i], 0);
    const sumX2 = xs.reduce((a, x) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const projected = intercept + slope * (n + 3); // 4 snapshots ahead
    return Math.min(100, Math.max(0, Math.round(projected)));
  }

  private relativeLabel(date: Date, now: Date): string {
    const days = Math.round(
      (now.getTime() - new Date(date).getTime()) / 86400000,
    );
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    if (days < 30) return `${Math.round(days / 7)} weeks ago`;
    if (days < 60) return '1 month ago';
    return `${Math.round(days / 30)} months ago`;
  }

  private emptyDiff(): GraphDiff {
    return {
      addedModules: [],
      removedModules: [],
      addedEdges: [],
      removedEdges: [],
      changedModules: [],
    };
  }

  /**
   * Renders a PlantUML component diagram showing what changed
   * between two snapshots. Red = degraded, green = improved, grey = unchanged.
   */
  private renderDiffDiagram(
    _before: PipelineResult,
    _after: PipelineResult,
    diff: GraphDiff,
  ): string {
    const lines = [
      '@startuml',
      "' Architecture diff diagram",
      'skinparam componentStyle rectangle',
      '',
      'package "Added" #E8FFE8 {',
      ...diff.addedModules.map((m) => `  [${m}] #A3E635`),
      '}',
      '',
      'package "Removed" #FFE8E8 {',
      ...diff.removedModules.map((m) => `  [${m}] #F87171`),
      '}',
      '',
      'package "Changed" #FFF8E8 {',
      ...diff.changedModules.map((m) => {
        const color =
          m.riskChange === 'improved'
            ? '#A3E635'
            : m.riskChange === 'degraded'
              ? '#F87171'
              : '#FCD34D';
        return `  [${m.module}] ${color}`;
      }),
      '}',
      '',
      ...diff.addedEdges.map((e) => `[${e.from}] --> [${e.to}] #A3E635`),
      ...diff.removedEdges.map(
        (e) => `[${e.from}] --> [${e.to}] #F87171 : removed`,
      ),
      '',
      '@enduml',
    ];
    return lines.join('\n');
  }
}
