/**
 * Class Diagram Generator
 *
 * Strategies used (all dynamic, no hardcoded lists):
 *
 * 1. DOMAIN GROUPING — Strategy C: Directory-based
 *    Uses the file's actual directory path (src/auth/, src/history/) as the
 *    package name. Falls back to edge-cluster analysis when filePaths are
 *    unavailable.
 *
 * 2. CROSS-CUTTING DETECTION — Strategy B: Fan-in/fan-out ratio
 *    A service is cross-cutting if fanIn >= threshold AND fanOut <= 1.
 *    Threshold is computed statistically (mean + 1σ of fan-in), not hardcoded.
 *
 * 3. FRAMEWORK FILTERING — Strategy A: Source-membership check
 *    Handled upstream in DiagramPrepService — edge targets not in graph.nodes
 *    are external/framework types and get filtered before reaching this generator.
 */

import { DiagramGraph } from './diagram-prep.service';
import { GraphNode } from '../graph/unified-graph.types';
import {
  sanitizeId,
  wrapDiagram,
  emptyDiagram,
  inferStereotype,
  arrowForEdge,
  labelForEdge,
  DiagramOptions,
} from './plantuml-builder';

export interface ClassDiagramOptions extends DiagramOptions {
  showPackages?: boolean;
  /** Max classes to show. Default: 25 */
  maxClasses?: number;
}

interface ClassNode {
  id: string;
  type: string;
  filePath?: string;
}

interface NodeGroup {
  packageName: string;
  nodes: ClassNode[];
}

/**
 * Generates a complete, valid PlantUML class diagram.
 */
export function generateClassDiagram(
  graph: DiagramGraph,
  options: ClassDiagramOptions = {},
): string {
  if (graph.nodes.length === 0) return emptyDiagram('class');

  const showPackages = options.showPackages ?? true;
  const maxClasses = options.maxClasses ?? 25;
  const lines: string[] = [];

  // ── 1. Compute degrees and detect cross-cutting ───────────────────────────

  const { fanIn, fanOut } = computeDegrees(graph);
  const crossCutting = detectCrossCuttingByRatio(graph, fanIn, fanOut);

  // ── 2. Select nodes (remove cross-cutting, apply maxClasses) ──────────────

  const kept = selectNodes(graph, crossCutting, fanIn, fanOut, maxClasses);

  // ── 3. Group by directory (Strategy C) ────────────────────────────────────

  const groups = groupByDirectory(kept, graph);

  // ── 4. Emit class declarations ────────────────────────────────────────────

  if (showPackages) {
    for (const group of groups) {
      if (group.nodes.length === 0) continue;
      lines.push(`package "${group.packageName}" {`);
      for (const node of group.nodes) {
        const stereotype = inferStereotype(node.type);
        lines.push(`  class ${node.id} ${stereotype} {`);
        lines.push('  }');
      }
      lines.push('}');
      lines.push('');
    }
  } else {
    for (const group of groups) {
      for (const node of group.nodes) {
        const stereotype = inferStereotype(node.type);
        lines.push(`class ${node.id} ${stereotype} {`);
        lines.push('}');
      }
    }
    lines.push('');
  }

  // ── 5. Note for folded cross-cutting services ─────────────────────────────

  if (crossCutting.size > 0) {
    const names = Array.from(crossCutting).slice(0, 5).join(', ');
    const extra =
      crossCutting.size > 5 ? ` (+${crossCutting.size - 5} more)` : '';
    lines.push(
      `note "Cross-cutting (omitted):\\n${names}${extra}" as CrossCutNote`,
    );
    lines.push('');
  }

  // ── 6. Emit relationships ─────────────────────────────────────────────────

  const declaredIds = new Set<string>();
  groups.forEach((g) => g.nodes.forEach((n) => declaredIds.add(n.id)));

  lines.push("' --- Dependencies ---");
  const seen = new Set<string>();

  graph.edges.forEach((e) => {
    const from = sanitizeId(e.from);
    const to = sanitizeId(e.to);
    const key = `${from}->${to}`;

    if (seen.has(key) || from === to) return;
    if (!declaredIds.has(from) || !declaredIds.has(to)) return;
    seen.add(key);

    const arrow = arrowForEdge(e.type);
    const label = labelForEdge(e.type);
    lines.push(
      label ? `${from} ${arrow} ${to} : ${label}` : `${from} ${arrow} ${to}`,
    );
  });

  return wrapDiagram('class', lines, {
    title: options.title ?? 'Class Diagram',
    ...options,
  });
}

// ── Degree computation ─────────────────────────────────────────────────────────

function computeDegrees(graph: DiagramGraph) {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();

  graph.edges.forEach((e) => {
    const from = sanitizeId(e.from);
    const to = sanitizeId(e.to);
    if (from === to) return;
    fanOut.set(from, (fanOut.get(from) ?? 0) + 1);
    fanIn.set(to, (fanIn.get(to) ?? 0) + 1);
  });

  return { fanIn, fanOut };
}

// ── Strategy B: Fan-in/fan-out ratio for cross-cutting detection ───────────────

/**
 * A service is cross-cutting if:
 * - fanIn >= dynamicThreshold (computed from mean + 1σ)
 * - fanOut <= 1 (it's a leaf service that doesn't orchestrate)
 *
 * This catches loggers, config services, cache wrappers, etc.
 * without any hardcoded name patterns.
 */
function detectCrossCuttingByRatio(
  graph: DiagramGraph,
  fanIn: Map<string, number>,
  fanOut: Map<string, number>,
): Set<string> {
  const result = new Set<string>();
  if (graph.nodes.length < 6) return result; // too small to meaningfully fold

  // Compute mean and stddev of fan-in
  const inValues = graph.nodes.map((n) => fanIn.get(sanitizeId(n.id)) ?? 0);
  const mean = inValues.reduce((a, b) => a + b, 0) / inValues.length;
  const variance =
    inValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / inValues.length;
  const stddev = Math.sqrt(variance);

  // Threshold: mean + 1σ, but at least 3 to avoid folding on flat graphs
  const threshold = Math.max(Math.ceil(mean + stddev), 3);

  for (const node of graph.nodes) {
    const id = sanitizeId(node.id);
    const fi = fanIn.get(id) ?? 0;
    const fo = fanOut.get(id) ?? 0;

    if (fi >= threshold && fo <= 1) {
      result.add(id);
    }
  }

  return result;
}

// ── Node selection ─────────────────────────────────────────────────────────────

function selectNodes(
  graph: DiagramGraph,
  crossCutting: Set<string>,
  fanIn: Map<string, number>,
  fanOut: Map<string, number>,
  maxClasses: number,
): ClassNode[] {
  const emitted = new Set<string>();

  let nodes: ClassNode[] = graph.nodes
    .map((n) => ({
      id: sanitizeId(n.id),
      type: n.type,
      filePath: n.filePath,
    }))
    .filter((n) => {
      if (emitted.has(n.id)) return false;
      emitted.add(n.id);
      if (crossCutting.has(n.id)) return false;
      return true;
    });

  if (nodes.length <= maxClasses) return nodes;

  // Keep the most connected nodes
  nodes.sort((a, b) => {
    const degA = (fanIn.get(a.id) ?? 0) + (fanOut.get(a.id) ?? 0);
    const degB = (fanIn.get(b.id) ?? 0) + (fanOut.get(b.id) ?? 0);
    return degB - degA;
  });

  return nodes.slice(0, maxClasses);
}

// ── Strategy C: Directory-based domain grouping ────────────────────────────────

/**
 * Groups nodes by their source directory.
 *
 * "src/auth/auth.service.ts"      → "auth"
 * "src/auth/auth.controller.ts"   → "auth"
 * "src/history/history.service.ts" → "history"
 *
 * Falls back to edge-cluster grouping when filePaths are unavailable.
 */
function groupByDirectory(
  nodes: ClassNode[],
  graph: DiagramGraph,
): NodeGroup[] {
  // Check if we have filePath info
  const nodesWithPath = nodes.filter((n) => n.filePath);

  if (nodesWithPath.length >= nodes.length * 0.5) {
    // Enough filePath coverage — use directory-based grouping
    return directoryGroup(nodes, graph);
  }

  // Fallback: edge-based clustering
  return edgeClusterGroup(nodes, graph);
}

/**
 * Primary strategy: group by the directory segment after "src/".
 */
function directoryGroup(
  nodes: ClassNode[],
  graph: DiagramGraph,
): NodeGroup[] {
  const domainMap = new Map<string, ClassNode[]>();

  for (const node of nodes) {
    const dir = extractDirectoryDomain(node.filePath);
    const domain = dir ?? 'Other';
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push(node);
  }

  return mapToGroups(domainMap);
}

/**
 * Extracts the meaningful directory segment from a relative file path.
 *
 * "src/auth/auth.service.ts"                → "auth"
 * "src/core/pipeline/analysis-pipeline.ts"  → "core"
 * "src/analysis/smells/smell-detector.ts"   → "analysis"
 */
function extractDirectoryDomain(filePath?: string): string | null {
  if (!filePath) return null;

  const parts = filePath.replace(/\\/g, '/').split('/');

  // Skip known boilerplate segments
  const skip = new Set([
    'src', 'lib', 'app', 'main', 'test', 'tests', '__tests__',
  ]);

  for (const part of parts) {
    // Stop at file name
    if (part.includes('.')) break;
    if (skip.has(part)) continue;
    // Return first meaningful directory
    return part;
  }

  return null;
}

/**
 * Fallback: cluster nodes by edge connectivity.
 * Nodes connected to each other get grouped together.
 */
function edgeClusterGroup(
  nodes: ClassNode[],
  graph: DiagramGraph,
): NodeGroup[] {
  // Build adjacency
  const adj = new Map<string, Set<string>>();
  graph.edges.forEach((e) => {
    const from = sanitizeId(e.from);
    const to = sanitizeId(e.to);
    if (!adj.has(from)) adj.set(from, new Set());
    if (!adj.has(to)) adj.set(to, new Set());
    adj.get(from)!.add(to);
    adj.get(to)!.add(from);
  });

  // Connected components via BFS
  const nodeIds = new Set(nodes.map((n) => n.id));
  const visited = new Set<string>();
  const clusters: Set<string>[] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const cluster = new Set<string>();
    const queue = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.add(current);
      const neighbors = adj.get(current) ?? new Set();
      for (const n of neighbors) {
        if (!visited.has(n) && nodeIds.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }

    clusters.push(cluster);
  }

  // Name each cluster by its most central node
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const domainMap = new Map<string, ClassNode[]>();

  for (const cluster of clusters) {
    const members = Array.from(cluster)
      .map((id) => nodeMap.get(id))
      .filter((n): n is ClassNode => n !== undefined);

    // Pick name: first controller, or largest prefix match
    const name = members.find((m) => m.type === 'controller')?.id
      ?? members[0]?.id
      ?? 'Unknown';

    // Strip suffix for package name
    const pkgName = stripSuffix(name);
    domainMap.set(pkgName, members);
  }

  return mapToGroups(domainMap);
}

function stripSuffix(name: string): string {
  const suffixes = [
    'Controller', 'Service', 'Module', 'Repository', 'Strategy',
    'Guard', 'Filter', 'Interceptor', 'Processor', 'Worker',
    'Engine', 'Factory', 'Provider',
  ];
  for (const s of suffixes) {
    if (name.endsWith(s) && name.length > s.length) {
      return name.slice(0, name.length - s.length);
    }
  }
  return name;
}

function mapToGroups(domainMap: Map<string, ClassNode[]>): NodeGroup[] {
  const groups: NodeGroup[] = [];
  for (const [domain, members] of domainMap) {
    if (members.length === 0) continue;
    groups.push({ packageName: domain, nodes: members });
  }
  groups.sort((a, b) => b.nodes.length - a.nodes.length);
  return groups;
}
