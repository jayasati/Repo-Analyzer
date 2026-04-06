export interface GraphStats {
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
  modules: Set<string>;
}

export function computeGraphStats(
  edges: { from: string; to: string }[],
): GraphStats {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const modules = new Set<string>();

  for (const edge of edges) {
    modules.add(edge.from);
    modules.add(edge.to);

    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);

    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
  }

  return { fanIn, fanOut, modules };
}
