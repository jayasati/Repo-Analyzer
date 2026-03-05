export interface Cycle {
  nodes: string[];
}

export class CycleDetectorService {

  detect(edges: { from: string; to: string }[]): Cycle[] {

    const graph = new Map<string, string[]>();

    // Build adjacency list
    for (const edge of edges) {

      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }

      graph.get(edge.from)!.push(edge.to);

      if (!graph.has(edge.to)) {
        graph.set(edge.to, []);
      }
    }

    const visited = new Set<string>();
    const stack = new Set<string>();
    const cycles: Cycle[] = [];

    const dfs = (node: string, path: string[]) => {

      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push({
          nodes: path.slice(cycleStart),
        });
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      const neighbors = graph.get(node) || [];

      for (const next of neighbors) {
        dfs(next, [...path, next]);
      }

      stack.delete(node);
    };

    for (const node of graph.keys()) {
      dfs(node, [node]);
    }

    return cycles;
  }
}

//This uses DFS cycle detection.