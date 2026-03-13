
import { Injectable } from '@nestjs/common';

export interface Cycle {
  nodes: string[];
}

@Injectable()
export class CycleDetectorService {

  detect(edges: { from: string; to: string }[]): Cycle[] {

    const graph = new Map<string, string[]>();

    for (const edge of edges) {
      if (!graph.has(edge.from)) graph.set(edge.from, []);
      if (!graph.has(edge.to)) graph.set(edge.to, []);
      graph.get(edge.from)!.push(edge.to);
    }

    let index = 0;
    const stack: string[] = [];
    const indices = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const cycles: Cycle[] = [];

    const strongConnect = (node: string) => {
      indices.set(node, index);
      lowlink.set(node, index);
      index++;

      stack.push(node);
      onStack.add(node);

      for (const next of graph.get(node) || []) {
        if (!indices.has(next)) {
          strongConnect(next);
          lowlink.set(node, Math.min(lowlink.get(node)!, lowlink.get(next)!));
        } else if (onStack.has(next)) {
          lowlink.set(node, Math.min(lowlink.get(node)!, indices.get(next)!));
        }
      }

      if (lowlink.get(node) === indices.get(node)) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== node);

        if (component.length > 1) {
          cycles.push({ nodes: component });
        }
      }
    };

    for (const node of graph.keys()) {
      if (!indices.has(node)) {
        strongConnect(node);
      }
    }

    return cycles;
  }
}