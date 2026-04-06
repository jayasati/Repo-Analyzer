import { Injectable } from '@nestjs/common';

import {
  UnifiedGraph,
  GraphNode,
  GraphEdge,
  NodeType,
} from './unified-graph.types';

@Injectable()
export class GraphMergeService {
  merge(
    structural: { nodes: { id: string; type: string }[]; edges: GraphEdge[] },
    semantic: { nodes: { id: string; type: string }[]; edges: GraphEdge[] },
  ): UnifiedGraph {
    const nodeMap = new Map<string, GraphNode>();

    // Structural file nodes are registered first so semantic nodes can
    // override them when the same id is resolved by both analyzers.
    for (const node of structural.nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        type: 'file',
        source: 'structural',
      });
    }

    // Semantic nodes carry richer type information (module, service, controller)
    // and take precedence over the generic 'file' type assigned above.
    for (const node of semantic.nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        type: node.type as NodeType, // NodeType union includes 'unknown' as a valid fallback
        source: 'semantic',
      });
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: [...structural.edges, ...semantic.edges],
    };
  }
}
