import { UnifiedGraph, GraphEdge, GraphNode } from '../graph/unified-graph.types';

import { Injectable } from '@nestjs/common';

export interface DiagramGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

@Injectable()
export class DiagramPrepService {

  // ========================
  // CLASS DIAGRAM
  // ========================
  forClassDiagram(graph: UnifiedGraph): DiagramGraph {
    const edges = this.normalizeEdges(
      graph.edges.filter(e => e.type === 'constructor-injection')
    );

    const nodeIds = new Set(
      edges.flatMap(e => [e.from, e.to])
    );

    const nodes = graph.nodes
      .filter(n =>
        nodeIds.has(this.normalizeId(n.id)) &&
        ['controller', 'service', 'class'].includes(n.type)
      )
      .map(n => ({
        ...n,
        id: this.normalizeId(n.id),
      }));

    return { nodes, edges };
  }

  // ========================
  // COMPONENT DIAGRAM
  // ========================
forComponentDiagram(graph: UnifiedGraph): DiagramGraph {
  const moduleNodes = new Set(
    graph.nodes
      .filter(n => n.type === 'module')
      .map(n => this.normalizeId(n.id))
  );

  const edges = this.normalizeEdges(
    graph.edges.filter(
      e =>
        e.type.startsWith('module-') &&
        moduleNodes.has(this.normalizeId(e.from)) &&
        moduleNodes.has(this.normalizeId(e.to))
    )
  );

  const nodes = graph.nodes
    .filter(n =>
      n.type === 'module' &&
      moduleNodes.has(this.normalizeId(n.id))
    )
    .map(n => ({
      ...n,
      id: this.normalizeId(n.id),
    }));

  return { nodes, edges };
}

  // ========================
  // SEQUENCE DIAGRAM
  // ========================
  forSequenceDiagram(
    graph: UnifiedGraph,
    entryPoint: string,
    maxDepth = 3,
  ): DiagramGraph {

    const edges = this.normalizeEdges(
      graph.edges.filter(e => e.type === 'constructor-injection')
    );

    const visited = new Set<string>();
    const resultEdges: GraphEdge[] = [];

    const walk = (node: string, depth: number) => {
      if (depth > maxDepth || visited.has(node)) return;
      visited.add(node);

      edges
        .filter(e => e.from === node)
        .forEach(e => {
          resultEdges.push(e);
          walk(e.to, depth + 1);
        });
    };

    walk(this.normalizeId(entryPoint), 0);

    const seenIds = new Set<string>();
    const nodes = graph.nodes
      .filter(n => visited.has(this.normalizeId(n.id)))
      .map(n => ({ ...n, id: this.normalizeId(n.id) }))
      .filter(n => {
        if (seenIds.has(n.id)) return false;
        seenIds.add(n.id);
        return true;
      });

    return { nodes, edges: resultEdges };
  }

  // ========================
  // HELPERS
  // ========================
  private normalizeId(id: string): string {
    if (id.includes('import(')) {
      const match = id.match(/\.([A-Za-z0-9_]+)\)?$/);
      return match ? match[1] : id;
    }

    if (id.includes('/') || id.includes('\\')) {
      return id.split(/[\\/]/).pop()!.replace(/\.(ts|js)$/, '');
    }

    return id;
  }

  private isValidNode(id: string): boolean {
    if (['string', 'number', 'boolean', 'any', 'unknown', 'void'].includes(id))
      return false;

    if (['@nestjs', 'fs', 'path', 'rxjs'].some(p => id.startsWith(p)))
      return false;

    return true;
  }

  private normalizeEdges(edges: GraphEdge[]): GraphEdge[] {
    return edges
      .map(e => ({
        ...e,
        from: this.normalizeId(e.from),
        to: this.normalizeId(e.to),
      }))
      .filter(e =>
        this.isValidNode(e.from) &&
        this.isValidNode(e.to)
      );
  }
}
