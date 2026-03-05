import * as path from "path";
import { DependencyGraph } from "../graph/unified-graph.types";

export interface PackageEdge {
  from: string;
  to: string;
}

export class PackageGraphService {

  build(graph: DependencyGraph) {

    const edges: PackageEdge[] = [];
    const seen = new Set<string>();

    for (const edge of graph.edges) {

      const fromPackage = this.getPackage(edge.from);
      const toPackage = this.getPackage(edge.to);

      if (!fromPackage || !toPackage) continue;
      if (fromPackage === toPackage) continue;

      const key = `${fromPackage}->${toPackage}`;

      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        from: fromPackage,
        to: toPackage,
      });

    }

    return edges;
  }

  private getPackage(filePath: string): string {

    const normalized = filePath.replace(/\\/g, "/");

    const parts = normalized.split("/");

    const srcIndex = parts.indexOf("src");

    if (srcIndex === -1 || srcIndex + 1 >= parts.length) {
      return parts[0];
    }

    return parts[srcIndex + 1];
  }
}