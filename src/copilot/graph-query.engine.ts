// ── src/copilot/graph-query.engine.ts ────────────────────────────────────────
//
// Rule-based graph queries — deterministic, zero latency, no LLM needed.
// Handles the most common developer questions without burning API credits.

import { Injectable } from '@nestjs/common';
import type { PipelineResult } from '../core/pipeline/pipeline-result.type';

type QueryResult = {
  type: string;
  matches: unknown[];
  summary: string;
};

@Injectable()
export class GraphQueryEngine {
  run(result: PipelineResult, query: Record<string, string>): QueryResult {
    switch (query.type) {
      case 'violations':
        return this.findViolations(result, query.layer);
      case 'dependents':
        return this.findDependents(result, query.module);
      case 'dependencies':
        return this.findDependencies(result, query.module);
      case 'cycles':
        return this.findCycles(result);
      case 'god-modules':
        return this.findGodModules(result);
      case 'dead-modules':
        return this.findDeadModules(result);
      case 'highly-coupled':
        return this.findHighlyCoupled(result);
      default:
        return {
          type: 'unknown',
          matches: [],
          summary: `Unknown query type: ${query.type}`,
        };
    }
  }

  private findViolations(result: PipelineResult, layer?: string): QueryResult {
    const smells = layer
      ? result.smells.filter((s) =>
          s.module?.toLowerCase().includes(layer.toLowerCase()),
        )
      : result.smells;
    return {
      type: 'violations',
      matches: smells.map((s) => ({
        module: s.module,
        type: s.type,
        severity: s.severity,
        message: s.message,
      })),
      summary: `Found ${smells.length} violations${layer ? ` in "${layer}" layer` : ''}.`,
    };
  }

  private findDependents(result: PipelineResult, module: string): QueryResult {
    const deps = result.smells
      .filter((s) => s.type === 'hub-dependency' && s.module === module)
      .flatMap((s) => (s.details ? [s.details] : []));

    const hubSmell = result.smells.find(
      (s) => s.type === 'hub-dependency' && s.module === module,
    );
    const count = (hubSmell?.details?.fanIn as number) ?? 0;

    return {
      type: 'dependents',
      matches: deps,
      summary: module
        ? `${count} modules depend on "${module}".`
        : 'Provide a module name.',
    };
  }

  private findDependencies(
    result: PipelineResult,
    module: string,
  ): QueryResult {
    const godSmell = result.smells.find(
      (s) => s.type === 'god-module' && s.module === module,
    );
    const fanOut = (godSmell?.details?.fanOut as number) ?? 0;
    return {
      type: 'dependencies',
      matches: godSmell ? [{ module, fanOut, details: godSmell.details }] : [],
      summary: module
        ? `"${module}" has ${fanOut} outgoing dependencies.`
        : 'Provide a module name.',
    };
  }

  private findCycles(result: PipelineResult): QueryResult {
    return {
      type: 'cycles',
      matches: result.cycles.map((c) => ({
        nodes: c.nodes,
        length: c.nodes.length,
      })),
      summary: `${result.cycles.length} circular dependency group(s) found.`,
    };
  }

  private findGodModules(result: PipelineResult): QueryResult {
    const matches = result.smells.filter((s) => s.type === 'god-module');
    return {
      type: 'god-modules',
      matches: matches.map((s) => ({
        module: s.module,
        severity: s.severity,
        fanOut: s.details?.fanOut,
      })),
      summary: `${matches.length} god-module(s) detected.`,
    };
  }

  private findDeadModules(result: PipelineResult): QueryResult {
    const matches = result.smells.filter((s) => s.type === 'dead-module');
    return {
      type: 'dead-modules',
      matches: matches.map((s) => ({ module: s.module })),
      summary: `${matches.length} potentially unused module(s).`,
    };
  }

  private findHighlyCoupled(result: PipelineResult): QueryResult {
    const sorted = result.hotspots.filter((h) => h.risk !== 'low');
    return {
      type: 'highly-coupled',
      matches: sorted.map((h) => ({
        module: h.module,
        fanOut: h.fanOut,
        risk: h.risk,
      })),
      summary: `${sorted.length} highly-coupled module(s). Top: ${sorted[0]?.module ?? 'none'}.`,
    };
  }
}
