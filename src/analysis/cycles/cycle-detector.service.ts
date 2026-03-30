import { Injectable } from '@nestjs/common';

export interface Cycle {
  nodes: string[];
}

/**
 * WHY iterative instead of recursive:
 *
 * The original recursive strongConnect() uses the call stack as its own
 * stack. Node.js has a default call-stack depth of ~10 000 frames.
 * A repo with 15 000 files and a dense dependency graph will throw
 * "Maximum call stack size exceeded" at runtime — a fatal crash in
 * production with no recovery path.
 *
 * The iterative version uses an explicit JS array as its stack, which
 * lives on the heap and is only limited by available RAM.
 *
 * Algorithm: Tarjan's SCC (iterative variant using a work-list).
 */
@Injectable()
export class CycleDetectorService {

  detect(edges: { from: string; to: string }[]): Cycle[] {
    // ── Build adjacency list ────────────────────────────────────────────────
    const graph = new Map<string, string[]>();

    for (const { from, to } of edges) {
      if (!graph.has(from)) graph.set(from, []);
      if (!graph.has(to))   graph.set(to,   []);
      graph.get(from)!.push(to);
    }

    // ── Tarjan iterative SCC ────────────────────────────────────────────────
    let   counter     = 0;
    const index       = new Map<string, number>();
    const lowlink     = new Map<string, number>();
    const onStack     = new Set<string>();
    const sccStack:   string[] = [];
    const cycles:     Cycle[]  = [];

    // Work-list entry: the node we're processing and the index into its
    // neighbour list that we've processed so far.
    interface Frame { node: string; neighbourIdx: number }
    const callStack: Frame[] = [];

    const visit = (start: string): void => {
      callStack.push({ node: start, neighbourIdx: 0 });
      index.set(start, counter);
      lowlink.set(start, counter);
      counter++;
      sccStack.push(start);
      onStack.add(start);

      while (callStack.length > 0) {
        const frame = callStack[callStack.length - 1];
        const { node } = frame;
        const neighbours = graph.get(node) ?? [];

        if (frame.neighbourIdx < neighbours.length) {
          const next = neighbours[frame.neighbourIdx++];

          if (!index.has(next)) {
            // Tree edge — push and start processing next
            callStack.push({ node: next, neighbourIdx: 0 });
            index.set(next, counter);
            lowlink.set(next, counter);
            counter++;
            sccStack.push(next);
            onStack.add(next);
          } else if (onStack.has(next)) {
            // Back edge — update lowlink
            lowlink.set(
              node,
              Math.min(lowlink.get(node)!, index.get(next)!),
            );
          }
        } else {
          // All neighbours processed — pop this frame
          callStack.pop();

          if (callStack.length > 0) {
            const parent = callStack[callStack.length - 1].node;
            lowlink.set(
              parent,
              Math.min(lowlink.get(parent)!, lowlink.get(node)!),
            );
          }

          // Check if this node is the root of an SCC
          if (lowlink.get(node) === index.get(node)) {
            const component: string[] = [];
            let w: string;
            do {
              w = sccStack.pop()!;
              onStack.delete(w);
              component.push(w);
            } while (w !== node);

            if (component.length > 1) {
              cycles.push({ nodes: component });
            }
          }
        }
      }
    };

    for (const node of graph.keys()) {
      if (!index.has(node)) visit(node);
    }

    return cycles;
  }
}