import { Injectable } from '@nestjs/common';
import { DiagramGraph } from './diagram-prep.service';

/**
 * WHY this is a full rewrite:
 *
 * The original renderer produced flat, unreadable diagrams:
 * - No stereotypes (<<Controller>>, <<Service>>, etc.)
 * - No grouping/packages
 * - No relationship labels
 * - No note blocks for smells
 * - Sequence diagram had no activation bars or return arrows
 * - Component diagram had no interface ports
 *
 * This version produces proper PlantUML that tools like PlantUML server,
 * kroki.io, or the VS Code extension can render into meaningful diagrams.
 */
@Injectable()
export class PlantUmlRendererService {

  // ── Class diagram ─────────────────────────────────────────────────────────

  renderClassDiagram(graph: DiagramGraph): string {
    if (graph.nodes.length === 0) return this.empty('class');

    const lines: string[] = [
      '@startuml',
      "' Auto-generated class diagram",
      'skinparam classAttributeIconSize 0',
      'skinparam classFontStyle bold',
      'skinparam ArrowColor #555555',
      'skinparam ClassBorderColor #888888',
      'skinparam ClassBackgroundColor #FAFAFA',
      'skinparam NoteBackgroundColor #FFFFCC',
      '',
    ];

    // Emit class nodes grouped by inferred type
    const controllers = graph.nodes.filter(n => n.type === 'controller');
    const services     = graph.nodes.filter(n => n.type === 'service');
    const others       = graph.nodes.filter(n => n.type !== 'controller' && n.type !== 'service');

    if (controllers.length > 0) {
      lines.push("' --- Controllers ---");
      controllers.forEach(n => {
        lines.push(`class ${this.sanitize(n.id)} <<Controller>> {`);
        lines.push('  + handleRequest()');
        lines.push('}');
      });
      lines.push('');
    }

    if (services.length > 0) {
      lines.push("' --- Services ---");
      services.forEach(n => {
        lines.push(`class ${this.sanitize(n.id)} <<Service>> {`);
        lines.push('  + execute()');
        lines.push('}');
      });
      lines.push('');
    }

    if (others.length > 0) {
      lines.push("' --- Other ---");
      others.forEach(n => {
        const stereotype = this.inferStereotype(n.type);
        lines.push(`class ${this.sanitize(n.id)} ${stereotype} {`);
        lines.push('}');
      });
      lines.push('');
    }

    // Emit relationships
    lines.push("' --- Dependencies ---");
    const seen = new Set<string>();
    graph.edges.forEach(e => {
      const from = this.sanitize(e.from);
      const to   = this.sanitize(e.to);
      const key  = `${from}->${to}`;
      if (seen.has(key) || from === to) return;
      seen.add(key);

      const label = e.type === 'constructor-injection' ? 'uses' : '';
      lines.push(label
        ? `${from} ..> ${to} : ${label}`
        : `${from} ..> ${to}`
      );
    });

    lines.push('');
    lines.push('@enduml');
    return lines.join('\n');
  }

  // ── Component diagram ─────────────────────────────────────────────────────

  renderComponentDiagram(graph: DiagramGraph): string {
    if (graph.nodes.length === 0) return this.empty('component');

    const lines: string[] = [
      '@startuml',
      "' Auto-generated component diagram",
      'skinparam componentStyle rectangle',
      'skinparam ArrowColor #555555',
      'skinparam ComponentBorderColor #888888',
      'skinparam ComponentBackgroundColor #EEF4FF',
      'skinparam DatabaseBackgroundColor #FFF4EE',
      '',
      'title Component Architecture',
      '',
    ];

    // Group components into a package if there are many
    const MAX_FLAT = 8;
    if (graph.nodes.length > MAX_FLAT) {
      lines.push('package "Application" {');
    }

    // Emit component nodes
    const emitted = new Set<string>();
    graph.nodes.forEach(n => {
      const name = this.sanitize(n.id);
      if (emitted.has(name)) return;
      emitted.add(name);

      const stereotype = n.type === 'module' ? '<<Module>>' : '<<Component>>';
      lines.push(`  [${name}] ${stereotype}`);
    });

    if (graph.nodes.length > MAX_FLAT) {
      lines.push('}');
    }

    lines.push('');
    lines.push("' --- Relationships ---");

    // Emit directed edges with deduplication
    const seen = new Set<string>();
    graph.edges.forEach(e => {
      const from = this.sanitize(e.from);
      const to   = this.sanitize(e.to);
      const key  = `${from}-->${to}`;
      if (seen.has(key) || from === to) return;
      seen.add(key);
      lines.push(`[${from}] --> [${to}]`);
    });

    // Emit reverse edges as dashed if they form a tangle
    const reverseEdges = graph.edges.filter(e => {
      const from = this.sanitize(e.from);
      const to   = this.sanitize(e.to);
      return seen.has(`${to}-->${from}`);
    });

    if (reverseEdges.length > 0) {
      lines.push('');
      lines.push("' --- Bidirectional tangles (potential smell) ---");
      reverseEdges.forEach(e => {
        const from = this.sanitize(e.from);
        const to   = this.sanitize(e.to);
        lines.push(`note on link: tangle`);
        lines.push(`[${from}] ..> [${to}]`);
      });
    }

    lines.push('');
    lines.push('@enduml');
    return lines.join('\n');
  }

  // ── Sequence diagram ──────────────────────────────────────────────────────

  renderSequenceDiagram(graph: DiagramGraph): string {
    if (graph.nodes.length === 0) return this.empty('sequence');

    const lines: string[] = [
      '@startuml',
      "' Auto-generated sequence diagram",
      'skinparam SequenceArrowThickness 2',
      'skinparam RoundCorner 5',
      'skinparam SequenceBoxBorderColor #888888',
      'skinparam ParticipantBackgroundColor #EEF4FF',
      'skinparam ActorBackgroundColor #FFF4EE',
      '',
      'autonumber',
      '',
    ];

    // Declare participants in order of appearance
    const declared = new Set<string>();
    const declareParticipant = (id: string, type: string) => {
      const name = this.sanitize(id);
      if (declared.has(name)) return;
      declared.add(name);
      const keyword = type === 'controller' ? 'actor'
        : type === 'service'               ? 'participant'
        : 'participant';
      lines.push(`${keyword} "${name}" as ${name}`);
    };

    // Declare participants from nodes
    graph.nodes.forEach(n => declareParticipant(n.id, n.type));
    lines.push('');

    // Figure out topological order for message flow
    const edgeMap = new Map<string, string[]>();
    graph.edges.forEach(e => {
      const from = this.sanitize(e.from);
      const to   = this.sanitize(e.to);
      if (!edgeMap.has(from)) edgeMap.set(from, []);
      edgeMap.get(from)!.push(to);
    });

    // Walk edges as a call sequence with activation
    const seen = new Set<string>();
    const walk = (from: string, depth: number): void => {
      if (depth > 6) return;
      const targets = edgeMap.get(from) ?? [];
      targets.forEach(to => {
        const key = `${from}->${to}`;
        if (seen.has(key)) return;
        seen.add(key);
        const indent = '  '.repeat(depth);
        lines.push(`${indent}activate ${from}`);
        lines.push(`${indent}${from} -> ${to} : call`);
        walk(to, depth + 1);
        lines.push(`${indent}${to} --> ${from} : return`);
        lines.push(`${indent}deactivate ${from}`);
      });
    };

    // Start from the first controller, or first participant
    const entryNode =
      graph.nodes.find(n => n.type === 'controller') ??
      graph.nodes[0];

    if (entryNode) {
      lines.push(`note over ${this.sanitize(entryNode.id)}: Entry point`);
      lines.push('');
      walk(this.sanitize(entryNode.id), 0);
    }

    lines.push('');
    lines.push('@enduml');
    return lines.join('\n');
  }

  // ── Dependency graph (new) ────────────────────────────────────────────────
  //
  // Produces a DOT/PlantUML hybrid that most renderers understand.
  // Shows the full package dependency graph, colour-coded by fan-out.

  renderDependencyGraph(
    edges:     { from: string; to: string }[],
    hotModules: Set<string> = new Set(),
  ): string {
    if (edges.length === 0) return this.empty('graph');

    const fanOut = new Map<string, number>();
    edges.forEach(e => fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1));

    const lines: string[] = [
      '@startuml',
      "' Package dependency graph",
      'skinparam packageStyle rectangle',
      '',
    ];

    // Emit colour-coded packages
    const allModules = new Set([...edges.map(e => e.from), ...edges.map(e => e.to)]);
    allModules.forEach(m => {
      const name = this.sanitize(m);
      const fo   = fanOut.get(m) ?? 0;
      const color = hotModules.has(m)  ? '#FFD0D0'
        : fo >= 6                       ? '#FFE8CC'
        : fo >= 3                       ? '#E8F4FF'
        : '#F0FFF0';
      lines.push(`package "${name}" as ${name} #${color.replace('#', '')} {`);
      lines.push('}');
    });

    lines.push('');

    const seen = new Set<string>();
    edges.forEach(e => {
      const from = this.sanitize(e.from);
      const to   = this.sanitize(e.to);
      const key  = `${from}->${to}`;
      if (seen.has(key) || from === to) return;
      seen.add(key);
      lines.push(`${from} ..> ${to}`);
    });

    lines.push('');
    lines.push('@enduml');
    return lines.join('\n');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private sanitize(id: string): string {
    // PlantUML identifiers: alphanumeric + underscore only
    return id
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+/, '')
      .replace(/_+$/, '')
      || 'Unknown';
  }

  private inferStereotype(type: string): string {
    switch (type) {
      case 'module':     return '<<Module>>';
      case 'service':    return '<<Service>>';
      case 'controller': return '<<Controller>>';
      case 'class':      return '<<Entity>>';
      default:           return '';
    }
  }

  private empty(type: string): string {
    return [`@startuml`, `note "No ${type} data available" as N`, `@enduml`].join('\n');
  }
}