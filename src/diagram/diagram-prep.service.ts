import { UnifiedGraph, GraphNode, GraphEdge } from '../graph/unified-graph.types';

export interface DiagramGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class DiagramPrepService {
  forClassDiagram(graph: UnifiedGraph): DiagramGraph {
    return {
      nodes: graph.nodes.filter(n =>
        ['class', 'service', 'controller'].includes(n.type),
      ),
      edges: graph.edges.filter(e =>
        ['constructor-injection'].includes(e.type),
      ),
    };
  }

  forComponentDiagram(graph: UnifiedGraph): DiagramGraph {
    return {
      nodes: graph.nodes.filter(n =>
        ['module'].includes(n.type),
      ),
      edges: graph.edges.filter(e =>
        e.type.startsWith('module-'),
      ),
    };
  }

  forSequenceDiagram(
    graph: UnifiedGraph,
    entryPoint: string,
  ): DiagramGraph {
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();

    const walk = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);

      graph.edges
        .filter(e => e.from === node)
        .forEach(e => {
          edges.push(e);
          walk(e.to);
        });
    };

    walk(entryPoint);

    const nodes = graph.nodes.filter(n =>
      visited.has(n.id),
    );

    return { nodes, edges };
  }
}
