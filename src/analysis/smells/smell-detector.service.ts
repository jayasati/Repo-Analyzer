import { Injectable } from '@nestjs/common';

import { ArchitectureSmell } from './smell.types';
import { GraphStats, computeGraphStats } from '../utils/graph-stats';
import type { DetectedFramework } from '../../detection/detection-result.type';

// ── Per-language threshold profiles ───────────────────────────────────────────
//
// godModule     — outgoing package-edge count that flags a god module.
// hubDependency — incoming package-edge count that flags a hub dependency.
//
// Rationale per framework:
//
//   nestjs / spring / aspnet / symfony
//     DI-heavy; aggregator modules importing 6–8 others are idiomatic.
//   angular
//     AppModule / SharedModule routinely import 10+ feature modules.
//   rails / laravel
//     ApplicationController and ServiceProvider are intentional hubs.
//   micronaut / ktor
//     Kotlin DI frameworks; moderate coupling is expected.
//   nextjs / django / phoenix / play / akka
//     Moderate fan-out acceptable; slightly stricter than DI-first frameworks.
//   express / koa / fastify / flask / fastapi
//     Micro-frameworks with no module system; high fan-out is a genuine smell.
//   gin / fiber / echo / actix / axum / rocket / vapor / sinatra / flutter
//     Lightweight or ownership-constrained; strict thresholds.
//   default
//     Conservative fallback for structural-only or unknown scans.

interface SmellThresholds {
  godModule:     number;
  hubDependency: number;
}

const FRAMEWORK_THRESHOLDS: Readonly<Record<string, SmellThresholds>> = {
  nestjs:    { godModule: 8,  hubDependency: 6 },
  angular:   { godModule: 10, hubDependency: 7 },
  spring:    { godModule: 8,  hubDependency: 6 },
  aspnet:    { godModule: 8,  hubDependency: 6 },
  symfony:   { godModule: 8,  hubDependency: 6 },
  laravel:   { godModule: 7,  hubDependency: 5 },
  rails:     { godModule: 7,  hubDependency: 5 },
  micronaut: { godModule: 7,  hubDependency: 5 },
  ktor:      { godModule: 6,  hubDependency: 5 },
  nextjs:    { godModule: 6,  hubDependency: 5 },
  django:    { godModule: 6,  hubDependency: 5 },
  phoenix:   { godModule: 7,  hubDependency: 5 },
  play:      { godModule: 6,  hubDependency: 5 },
  akka:      { godModule: 6,  hubDependency: 5 },
  express:   { godModule: 5,  hubDependency: 4 },
  koa:       { godModule: 5,  hubDependency: 4 },
  fastify:   { godModule: 5,  hubDependency: 4 },
  flask:     { godModule: 5,  hubDependency: 4 },
  fastapi:   { godModule: 5,  hubDependency: 4 },
  gin:       { godModule: 4,  hubDependency: 4 },
  fiber:     { godModule: 4,  hubDependency: 4 },
  echo:      { godModule: 4,  hubDependency: 4 },
  actix:     { godModule: 4,  hubDependency: 4 },
  axum:      { godModule: 4,  hubDependency: 4 },
  rocket:    { godModule: 4,  hubDependency: 4 },
  vapor:     { godModule: 4,  hubDependency: 4 },
  flutter:   { godModule: 4,  hubDependency: 4 },
  sinatra:   { godModule: 4,  hubDependency: 4 },
};

const DEFAULT_THRESHOLDS: SmellThresholds = { godModule: 6, hubDependency: 5 };

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SmellDetectorService {

  /**
   * Detect architecture smells in a set of package-level edges.
   *
   * @param packageEdges  Directed edges between top-level packages.
   * @param framework     Optional detected framework — used to select the
   *                      correct god-module / hub-dependency thresholds.
   */
  detect(
    packageEdges: { from: string; to: string }[],
    framework?:   DetectedFramework,
  ): ArchitectureSmell[] {
    const stats      = computeGraphStats(packageEdges);
    const thresholds = this.resolveThresholds(framework);

    return [
      ...this.detectGodModules(stats.fanOut, thresholds.godModule),
      ...this.detectHubDependencies(stats.fanIn, thresholds.hubDependency),
      ...this.detectDeadModules(stats),
    ];
  }

  // ── Detection helpers ────────────────────────────────────────────────────

  private detectGodModules(
    fanOut:    Map<string, number>,
    threshold: number,
  ): ArchitectureSmell[] {
    return Array.from(fanOut.entries())
      .filter(([, count]) => count >= threshold)
      .map(([module, count]) => ({
        type:     'god-module'  as const,
        message:  `${module} depends on too many modules (${count})`,
        severity: 'high'        as const,
        module,
      }));
  }

  private detectHubDependencies(
    fanIn:     Map<string, number>,
    threshold: number,
  ): ArchitectureSmell[] {
    return Array.from(fanIn.entries())
      .filter(([, count]) => count >= threshold)
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
   * of the dependency graph and must never be flagged as dead modules.
   */
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