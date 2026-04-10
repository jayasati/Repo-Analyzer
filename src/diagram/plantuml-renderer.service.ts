import { Injectable } from '@nestjs/common';
import { DiagramGraph } from './diagram-prep.service';
import { generateClassDiagram, ClassDiagramOptions } from './class-generator';
import {
  generateComponentDiagram,
  ComponentDiagramOptions,
} from './component-generator';
import {
  generateSequenceDiagram,
  SequenceOptions,
} from './sequence-generator';
import {
  sanitizeId,
  wrapDiagram,
  emptyDiagram,
  DiagramOptions,
} from './plantuml-builder';

/**
 * PlantUML Renderer Service
 *
 * Delegates to dedicated generator modules for each diagram type.
 * Each generator returns valid, self-contained PlantUML that compiles cleanly.
 *
 * The renderer remains the single injectable entry point for the pipeline,
 * while the actual logic lives in focused, testable generator functions.
 */
@Injectable()
export class PlantUmlRendererService {
  // ── Class diagram ─────────────────────────────────────────────────────────

  renderClassDiagram(
    graph: DiagramGraph,
    options?: ClassDiagramOptions,
  ): string {
    return generateClassDiagram(graph, options);
  }

  // ── Component diagram ─────────────────────────────────────────────────────

  renderComponentDiagram(
    graph: DiagramGraph,
    options?: ComponentDiagramOptions,
  ): string {
    return generateComponentDiagram(graph, options);
  }

  // ── Sequence diagram ──────────────────────────────────────────────────────

  renderSequenceDiagram(
    graph: DiagramGraph,
    options?: SequenceOptions,
  ): string {
    return generateSequenceDiagram(graph, options);
  }

  // ── Dependency graph ──────────────────────────────────────────────────────

  renderDependencyGraph(
    edges: { from: string; to: string }[],
    hotModules: Set<string> = new Set(),
  ): string {
    if (edges.length === 0) return emptyDiagram('graph');

    const fanOut = new Map<string, number>();
    edges.forEach((e) => fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1));

    const lines: string[] = [];

    // Emit colour-coded packages
    const allModules = new Set([
      ...edges.map((e) => e.from),
      ...edges.map((e) => e.to),
    ]);
    allModules.forEach((m) => {
      const name = sanitizeId(m);
      const fo = fanOut.get(m) ?? 0;
      const color = hotModules.has(m)
        ? '#FFD0D0'
        : fo >= 6
          ? '#FFE8CC'
          : fo >= 3
            ? '#E8F4FF'
            : '#F0FFF0';
      lines.push(
        `package "${name}" as ${name} ${color} {`,
      );
      lines.push('}');
    });

    lines.push('');

    const seen = new Set<string>();
    edges.forEach((e) => {
      const from = sanitizeId(e.from);
      const to = sanitizeId(e.to);
      const key = `${from}->${to}`;
      if (seen.has(key) || from === to) return;
      seen.add(key);
      lines.push(`${from} ..> ${to}`);
    });

    return wrapDiagram('graph', lines, { title: 'Dependency Graph' });
  }
}
