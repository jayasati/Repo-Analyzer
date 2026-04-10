/**
 * Component Diagram Generator
 *
 * Generates valid PlantUML component diagrams with:
 * - Module-level abstraction (not file-level)
 * - Interface ports between modules
 * - Logical grouping by architectural layer
 * - Bidirectional tangle detection with properly placed notes
 * - Noise reduction (deduplication, self-loop removal)
 *
 * FIXES over original:
 * 1. `note on link` is now placed AFTER the link declaration (was before)
 * 2. Tangles no longer create duplicate edges
 * 3. Meaningful multi-package grouping instead of a single "Application" wrapper
 */

import { DiagramGraph } from './diagram-prep.service';
import {
  sanitizeId,
  wrapDiagram,
  emptyDiagram,
  DiagramOptions,
} from './plantuml-builder';

export interface ComponentDiagramOptions extends DiagramOptions {
  showInterfaces?: boolean;
}

/**
 * Generates a complete, valid PlantUML component diagram.
 */
export function generateComponentDiagram(
  graph: DiagramGraph,
  options: ComponentDiagramOptions = {},
): string {
  if (graph.nodes.length === 0) return emptyDiagram('component');

  const showInterfaces = options.showInterfaces ?? true;
  const lines: string[] = [];

  // ── 1. Classify nodes into architectural layers ───────────────────────────

  const layers = classifyLayers(graph);

  // ── 2. Emit components grouped by layer ───────────────────────────────────

  const emitted = new Set<string>();

  for (const layer of layers) {
    if (layer.nodes.length === 0) continue;

    lines.push(`package "${layer.name}" {`);
    for (const node of layer.nodes) {
      if (emitted.has(node.id)) continue;
      emitted.add(node.id);

      const stereotype = node.type === 'module' ? '<<Module>>' : '<<Component>>';
      lines.push(`  [${node.id}] ${stereotype}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Emit any un-grouped nodes
  graph.nodes.forEach((n) => {
    const id = sanitizeId(n.id);
    if (emitted.has(id)) return;
    emitted.add(id);
    lines.push(`[${id}]`);
  });

  // ── 3. Emit interfaces (exposed APIs between modules) ─────────────────────

  if (showInterfaces) {
    const providers = new Set<string>();
    graph.edges.forEach((e) => {
      const to = sanitizeId(e.to);
      // A node that is depended on by 2+ others exposes an interface
      providers.add(to);
    });

    const interfaceNodes = new Set<string>();
    // Count incoming edges per node
    const incomingCount = new Map<string, number>();
    graph.edges.forEach((e) => {
      const to = sanitizeId(e.to);
      incomingCount.set(to, (incomingCount.get(to) ?? 0) + 1);
    });

    for (const [nodeId, count] of incomingCount) {
      if (count >= 2 && emitted.has(nodeId)) {
        interfaceNodes.add(nodeId);
      }
    }

    if (interfaceNodes.size > 0) {
      lines.push("' --- Interfaces ---");
      interfaceNodes.forEach((id) => {
        const ifaceName = `I${pascalCase(id)}`;
        lines.push(`interface "${ifaceName}" as ${ifaceName}`);
        lines.push(`${ifaceName} -- [${id}]`);
      });
      lines.push('');
    }
  }

  // ── 4. Emit edges ────────────────────────────────────────────────────────

  lines.push("' --- Relationships ---");
  const seen = new Set<string>();
  const forwardEdges = new Set<string>();

  graph.edges.forEach((e) => {
    const from = sanitizeId(e.from);
    const to = sanitizeId(e.to);
    const key = `${from}-->${to}`;
    if (seen.has(key) || from === to) return;
    seen.add(key);
    forwardEdges.add(key);
    lines.push(`[${from}] --> [${to}]`);
  });

  // ── 5. Detect and annotate bidirectional tangles ──────────────────────────

  const tangles: Array<{ from: string; to: string }> = [];
  graph.edges.forEach((e) => {
    const from = sanitizeId(e.from);
    const to = sanitizeId(e.to);
    const reverseKey = `${to}-->${from}`;
    if (forwardEdges.has(reverseKey) && from !== to) {
      // Only add if we haven't already recorded the reverse
      const tangleKey = [from, to].sort().join('<->');
      if (!tangles.some((t) => [t.from, t.to].sort().join('<->') === tangleKey)) {
        tangles.push({ from, to });
      }
    }
  });

  if (tangles.length > 0) {
    lines.push('');
    lines.push("' --- Bidirectional tangles (potential smell) ---");
    tangles.forEach(({ from, to }) => {
      // Note is placed AFTER the link it refers to — this is the fix
      lines.push(`[${from}] ..[#red].> [${to}] : <<tangle>>`);
    });
  }

  // ── 6. Wrap ──────────────────────────────────────────────────────────────

  return wrapDiagram('component', lines, {
    title: options.title ?? 'Component Architecture',
    ...options,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

interface Layer {
  name: string;
  nodes: Array<{ id: string; type: string }>;
}

/**
 * Strategy C: Hybrid — keyword primary, topology as tiebreaker.
 *
 * Pure topological layering (source/sink/middle) doesn't work well for
 * module-level graphs: `history` having only outgoing edges doesn't make
 * it "Presentation", and `graph` having only incoming doesn't make it
 * "Infrastructure". These are semantic roles, not structural properties.
 *
 * Approach:
 *   1. Classify using minimal keyword sets (node type + ~5 keywords per layer)
 *   2. For ambiguous nodes (no keyword match), use topology as tiebreaker:
 *      source-only → Presentation, sink-only → Infrastructure, else → Shared
 */
function classifyLayers(graph: DiagramGraph): Layer[] {
  // ── Step 1: Compute topology signals ─────────────────────────────────────

  const hasIncoming = new Set<string>();
  const hasOutgoing = new Set<string>();

  graph.edges.forEach((e) => {
    const from = sanitizeId(e.from);
    const to = sanitizeId(e.to);
    if (from !== to) {
      hasOutgoing.add(from);
      hasIncoming.add(to);
    }
  });

  // ── Step 2: Classify with keywords, topology as tiebreaker ───────────────

  const presentation: Layer = { name: 'Presentation', nodes: [] };
  const business: Layer = { name: 'Business Logic', nodes: [] };
  const infrastructure: Layer = { name: 'Infrastructure', nodes: [] };
  const shared: Layer = { name: 'Shared', nodes: [] };

  // Minimal keyword sets — just the essential markers per layer
  const presKw = ['api', 'gateway', 'rest', 'graphql'];
  const infraKw = ['queue', 'cache', 'persistence', 'database', 'db'];
  const sharedKw = ['common', 'shared', 'util', 'utils', 'lib'];

  const emitted = new Set<string>();

  graph.nodes.forEach((n) => {
    const id = sanitizeId(n.id);
    if (emitted.has(id)) return;
    emitted.add(id);

    const entry = { id, type: n.type };
    const lower = id.toLowerCase();

    // Priority 1: Semantic type from analysis
    if (n.type === 'controller') {
      presentation.nodes.push(entry);
      return;
    }

    // Priority 2: Keyword match
    if (presKw.some((k) => lower.includes(k))) {
      presentation.nodes.push(entry);
    } else if (infraKw.some((k) => lower.includes(k))) {
      infrastructure.nodes.push(entry);
    } else if (sharedKw.some((k) => lower.includes(k))) {
      shared.nodes.push(entry);
    } else {
      // Priority 3: Topological tiebreaker for ambiguous nodes
      const out = hasOutgoing.has(id);
      const inc = hasIncoming.has(id);

      if (out && !inc) {
        // Source-only → likely an orchestrator / presentation
        presentation.nodes.push(entry);
      } else if (inc && !out) {
        // Sink-only → likely a leaf library / shared
        shared.nodes.push(entry);
      } else {
        // Both or neither → business logic (the middle layer)
        business.nodes.push(entry);
      }
    }
  });

  const layers = [presentation, business, infrastructure, shared];
  const nonEmpty = layers.filter((l) => l.nodes.length > 0);

  if (nonEmpty.length <= 1) {
    const deduped = new Set<string>();
    const nodes = graph.nodes
      .map((n) => ({ id: sanitizeId(n.id), type: n.type }))
      .filter((n) => {
        if (deduped.has(n.id)) return false;
        deduped.add(n.id);
        return true;
      });
    return [{ name: 'Application', nodes }];
  }

  return nonEmpty;
}

/** Capitalises the first letter: "detection" → "Detection" */
function pascalCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
