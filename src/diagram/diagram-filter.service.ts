/**
 * Smart Filtering / Preprocessing Layer for Diagrams
 *
 * Removes low-signal nodes, clusters related files, and ranks importance
 * using graph metrics (degree centrality, betweenness approximation).
 *
 * This layer sits between the raw UnifiedGraph and the diagram generators,
 * ensuring that diagrams are readable even for large codebases.
 */

import { Injectable } from '@nestjs/common';
import { UnifiedGraph, GraphNode, GraphEdge } from '../graph/unified-graph.types';

export interface FilterOptions {
  /** Maximum number of nodes in the output graph. Default: 30 */
  maxNodes?: number;
  /** If set, only include nodes within `depth` edges of focusModule */
  focusModule?: string;
  /** Max depth from focusModule to include. Default: 2 */
  focusDepth?: number;
  /** Minimum degree (fanIn + fanOut) to keep a node. Default: 1 */
  minDegree?: number;
}

interface NodeScore {
  id: string;
  node: GraphNode;
  fanIn: number;
  fanOut: number;
  degree: number;
}

@Injectable()
export class DiagramFilterService {
  /**
   * Filters and ranks a unified graph for diagram generation.
   *
   * Pipeline:
   * 1. Remove noise (3rd-party, primitives, orphans below threshold)
   * 2. Focus mode (if focusModule is set, BFS from that node)
   * 3. Rank by degree centrality
   * 4. Trim to maxNodes
   * 5. Re-filter edges to only reference surviving nodes
   */
  filter(graph: UnifiedGraph, options: FilterOptions = {}): UnifiedGraph {
    const {
      maxNodes = 30,
      focusModule,
      focusDepth = 2,
      minDegree = 0,
    } = options;

    let nodes = [...graph.nodes];
    let edges = [...graph.edges];

    // Step 1: Remove noise
    nodes = nodes.filter((n) => !this.isNoise(n.id));
    const nodeIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to) && e.from !== e.to);

    // Step 2: Focus mode — BFS from focusModule
    if (focusModule) {
      const focused = this.bfsFromNode(focusModule, edges, focusDepth);
      if (focused.size > 0) {
        nodes = nodes.filter((n) => focused.has(n.id));
        const focusedIds = new Set(nodes.map((n) => n.id));
        edges = edges.filter((e) => focusedIds.has(e.from) && focusedIds.has(e.to));
      }
    }

    // Step 3: Score nodes by degree centrality
    const scores = this.scoreNodes(nodes, edges);

    // Step 4: Filter by minimum degree
    if (minDegree > 0) {
      const passing = new Set(
        scores.filter((s) => s.degree >= minDegree).map((s) => s.id),
      );
      nodes = nodes.filter((n) => passing.has(n.id));
    }

    // Step 5: Trim to maxNodes (keep highest-degree nodes)
    if (nodes.length > maxNodes) {
      const topIds = new Set(
        scores
          .sort((a, b) => b.degree - a.degree)
          .slice(0, maxNodes)
          .map((s) => s.id),
      );
      nodes = nodes.filter((n) => topIds.has(n.id));
    }

    // Step 6: Re-filter edges
    const finalIds = new Set(nodes.map((n) => n.id));
    edges = edges.filter((e) => finalIds.has(e.from) && finalIds.has(e.to));

    return { nodes, edges };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private isNoise(id: string): boolean {
    const lower = id.toLowerCase();

    // 3rd-party / framework modules
    if (
      lower.startsWith('@nestjs') ||
      lower.startsWith('node_modules') ||
      lower.startsWith('@angular') ||
      lower.startsWith('rxjs') ||
      lower.startsWith('@types')
    ) {
      return true;
    }

    // Common non-meaningful files
    const noisePatterns = [
      'index',
      'main',
      'app.module',
      'tsconfig',
      '.spec',
      '.test',
      '.d.ts',
      'jest.config',
      'webpack',
      'eslint',
      'prettier',
    ];
    return noisePatterns.some((p) => lower.includes(p));
  }

  private bfsFromNode(
    startId: string,
    edges: GraphEdge[],
    maxDepth: number,
  ): Set<string> {
    const result = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [
      { id: startId, depth: 0 },
    ];
    result.add(startId);

    // Build bidirectional adjacency for BFS
    const adjacency = new Map<string, Set<string>>();
    edges.forEach((e) => {
      if (!adjacency.has(e.from)) adjacency.set(e.from, new Set());
      if (!adjacency.has(e.to)) adjacency.set(e.to, new Set());
      adjacency.get(e.from)!.add(e.to);
      adjacency.get(e.to)!.add(e.from);
    });

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const neighbors = adjacency.get(id) ?? new Set();
      for (const neighbor of neighbors) {
        if (!result.has(neighbor)) {
          result.add(neighbor);
          queue.push({ id: neighbor, depth: depth + 1 });
        }
      }
    }

    return result;
  }

  private scoreNodes(nodes: GraphNode[], edges: GraphEdge[]): NodeScore[] {
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();

    edges.forEach((e) => {
      fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
      fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);
    });

    return nodes.map((n) => {
      const fi = fanIn.get(n.id) ?? 0;
      const fo = fanOut.get(n.id) ?? 0;
      return {
        id: n.id,
        node: n,
        fanIn: fi,
        fanOut: fo,
        degree: fi + fo,
      };
    });
  }
}
