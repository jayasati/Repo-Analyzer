import { DependencyGraph } from '../graph/graph.types';

export function computeStructuralMetrics(
  graph: DependencyGraph
) {
  const fileCount = graph.nodes.length;
  const dependencyCount = graph.edges.length;

  const fanOut: Record<string, number> = {};

  //e => is an edge (dependency) in the graph
  graph.edges.forEach(e => {
    fanOut[e.from] = (fanOut[e.from] || 0) + 1;
  });

  const maxFanOut = Math.max(0, ...Object.values(fanOut));
  const avgFanOut =
    Object.values(fanOut).reduce((a, b) => a + b, 0) /
    (Object.keys(fanOut).length || 1);

  return {
    fileCount,
    dependencyCount,
    maxFanOut,
    avgFanOut: Number(avgFanOut.toFixed(2)),
  };
}

/*
These metrics will later:
Feed confidence score
Detect God files
Power change impact
*/