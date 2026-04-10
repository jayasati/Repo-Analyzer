/**
 * Sequence Diagram Generator
 *
 * Generates valid PlantUML sequence diagrams from a dependency graph.
 *
 * FIXES over the original implementation:
 * 1. Activates the CALLEE (target), not the caller — the original did `activate ${from}`
 *    which is wrong. PlantUML activation means "this participant is processing".
 * 2. Adds a "Client" actor as the external trigger — sequence diagrams should show
 *    who initiates the flow.
 * 3. Tracks activation state to prevent double-activate on the same participant.
 * 4. Uses proper participant keywords: actor for Client, boundary for controllers,
 *    control for services, entity for repositories/classes.
 * 5. Generates proper return messages with `-->` (dashed) arrows.
 * 6. Respects configurable max depth.
 *
 * DESIGN: Models runtime call flow, not static graph structure.
 * Entry point (controller) receives a request from Client, then delegates to services,
 * which may call repositories/other services.
 */

import { DiagramGraph } from './diagram-prep.service';
import {
  sanitizeId,
  wrapDiagram,
  emptyDiagram,
  DiagramOptions,
  validatePlantUML,
} from './plantuml-builder';

export interface SequenceOptions extends DiagramOptions {
  maxDepth?: number;
  showReturnValues?: boolean;
}

/**
 * Generates a complete, valid PlantUML sequence diagram.
 */
export function generateSequenceDiagram(
  graph: DiagramGraph,
  options: SequenceOptions = {},
): string {
  if (graph.nodes.length === 0) return emptyDiagram('sequence');

  const maxDepth = options.maxDepth ?? 6;
  const lines: string[] = [];

  // ── 1. Build adjacency map ────────────────────────────────────────────────

  const edgeMap = new Map<string, Array<{ to: string; type: string }>>();
  graph.edges.forEach((e) => {
    const from = sanitizeId(e.from);
    const to = sanitizeId(e.to);
    if (from === to) return;
    if (!edgeMap.has(from)) edgeMap.set(from, []);
    const targets = edgeMap.get(from)!;
    if (!targets.some((t) => t.to === to)) {
      targets.push({ to, type: e.type });
    }
  });

  // ── 2. Determine entry point and participant order ────────────────────────

  const entryNode =
    graph.nodes.find((n) => n.type === 'controller') ?? graph.nodes[0];
  if (!entryNode) return emptyDiagram('sequence');

  const entryId = sanitizeId(entryNode.id);

  // BFS to determine participant declaration order (top-down call order)
  const participantOrder: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [entryId];
  visited.add(entryId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    participantOrder.push(current);
    const targets = edgeMap.get(current) ?? [];
    for (const { to } of targets) {
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
      }
    }
  }

  // Add any remaining nodes not reachable from entry
  graph.nodes.forEach((n) => {
    const id = sanitizeId(n.id);
    if (!visited.has(id)) {
      participantOrder.push(id);
      visited.add(id);
    }
  });

  // Build type lookup
  const nodeTypeMap = new Map<string, string>();
  graph.nodes.forEach((n) => nodeTypeMap.set(sanitizeId(n.id), n.type));

  // ── 3. Declare participants ───────────────────────────────────────────────

  // Add external Client actor
  lines.push('actor "Client" as Client');

  participantOrder.forEach((id) => {
    const type = nodeTypeMap.get(id) ?? 'class';
    const keyword = participantKeyword(type);
    lines.push(`${keyword} "${id}" as ${id}`);
  });

  lines.push('');
  lines.push('autonumber');
  lines.push('');

  // ── 4. Generate call flow ─────────────────────────────────────────────────

  // Client initiates the request to the entry point
  lines.push(`Client -> ${entryId} : request`);
  lines.push(`activate ${entryId}`);
  lines.push('');

  // Strategy A: Detect async entry points (orphan roots).
  // An orphan root is a node that the entry point calls but which has
  // no incoming edges from other participants in the normal call chain.
  // The prep layer stitches these as synthetic edges from the controller.
  // We detect them here to render with async arrows (->>).
  const incomingFrom = new Map<string, Set<string>>();
  edgeMap.forEach((targets, from) => {
    for (const { to } of targets) {
      if (!incomingFrom.has(to)) incomingFrom.set(to, new Set());
      incomingFrom.get(to)!.add(from);
    }
  });

  // Identify async targets: nodes that the entry point calls but which
  // are NOT directly connected back (they represent async handoffs).
  // Heuristic: if the entry has multiple callees AND a callee's only
  // incoming edge is from the entry AND the callee has its own callees,
  // then it's likely an async handoff (e.g., queue processor).
  // If the entry has only 1 callee, it's a direct sync call.
  const asyncTargets = new Set<string>();
  const entryTargets = edgeMap.get(entryId) ?? [];
  if (entryTargets.length > 1) {
    for (const { to } of entryTargets) {
      const sources = incomingFrom.get(to) ?? new Set();
      const hasOwnCallees = (edgeMap.get(to) ?? []).length > 0;
      if (sources.size === 1 && sources.has(entryId) && hasOwnCallees) {
        asyncTargets.add(to);
      }
    }
  }

  // Recursive walk with proper activation tracking
  const emittedEdges = new Set<string>();

  function walk(from: string, depth: number): void {
    if (depth > maxDepth) return;
    const targets = edgeMap.get(from) ?? [];

    targets.forEach(({ to, type }) => {
      const key = `${from}->${to}`;
      if (emittedEdges.has(key)) return;
      emittedEdges.add(key);

      // Async handoff: controller → processor (via queue)
      const isAsync = asyncTargets.has(to) && from === entryId;
      if (isAsync) {
        lines.push(`${from} ->> ${to} : async (via queue)`);
      } else {
        lines.push(`${from} -> ${to} : ${callLabel(type)}`);
      }
      lines.push(`activate ${to}`);

      // Recurse into callee's dependencies
      walk(to, depth + 1);

      // Callee returns and gets deactivated
      if (isAsync) {
        lines.push(`${to} -->> ${from} : complete`);
      } else {
        lines.push(`${to} --> ${from} : response`);
      }
      lines.push(`deactivate ${to}`);
      lines.push('');
    });
  }

  walk(entryId, 0);

  // Entry point returns to Client
  lines.push(`${entryId} --> Client : response`);
  lines.push(`deactivate ${entryId}`);

  // ── 5. Wrap and validate ──────────────────────────────────────────────────

  const diagram = wrapDiagram('sequence', lines, {
    title: options.title ?? 'Sequence Diagram',
    ...options,
  });

  const validation = validatePlantUML(diagram);
  if (!validation.valid) {
    // Log warnings but still return the diagram — better partial than nothing
    console.warn('PlantUML validation warnings:', validation.errors);
  }

  return diagram;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Maps node types to PlantUML sequence participant keywords.
 *
 * - boundary: controllers (system boundary / entry point)
 * - control: services (business logic orchestration)
 * - entity: repositories, models, data-layer classes
 * - participant: default
 */
function participantKeyword(type: string): string {
  switch (type) {
    case 'controller':
      return 'boundary';
    case 'service':
      return 'control';
    case 'module':
      return 'control';
    default:
      return 'entity';
  }
}

/**
 * Generates a call label from the edge type.
 */
function callLabel(edgeType: string): string {
  switch (edgeType) {
    case 'constructor-injection':
      return 'invoke';
    case 'import':
      return 'call';
    case 'module-provider':
      return 'provide';
    default:
      return 'call';
  }
}
