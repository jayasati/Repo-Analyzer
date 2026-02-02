import { UnifiedGraph, GraphNode, GraphEdge } from './unified-graph.types';

export class GraphMergeService {
  merge(
    structural: { nodes: any[]; edges: GraphEdge[] },
    semantic: {
      nodes: { id: string; type: string }[];
      edges: GraphEdge[];
    },
  ): UnifiedGraph {
    const nodeMap = new Map<string, GraphNode>();

    // 1️⃣ Structural file nodes
    for (const node of structural.nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        type: 'file',
        source: 'structural',
      });
    }

    // 2️⃣ Semantic nodes (modules, services, controllers)
    for (const node of semantic.nodes) {
      nodeMap.set(node.id, {
        id: node.id,
        type: node.type as any,
        source: 'semantic',
      });
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges: [
        ...structural.edges,
        ...semantic.edges,
      ],
    };
  }
}
