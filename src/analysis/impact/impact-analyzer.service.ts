import { ImpactResult } from "./impact.types";

export class ImpactAnalyzerService {

  analyze(
    edges: { from: string; to: string }[],
    target: string
  ): ImpactResult {

    const reverseGraph = new Map<string, string[]>();

    edges.forEach(edge => {
      if (!reverseGraph.has(edge.to)) {
        reverseGraph.set(edge.to, []);
      }
      reverseGraph.get(edge.to)!.push(edge.from);
    });

    const visited = new Set<string>();
    const stack = [target];
    const affected: string[] = [];

    while (stack.length) {
      const node = stack.pop()!;
      const dependents = reverseGraph.get(node) || [];

      dependents.forEach(dep => {
        if (!visited.has(dep)) {
          visited.add(dep);
          affected.push(dep);
          stack.push(dep);
        }
      });
    }

    return { target, affected };
  }
}