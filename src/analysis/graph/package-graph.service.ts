import { Injectable } from '@nestjs/common';

import { DependencyGraph } from '../../graph/unified-graph.types';

export interface PackageEdge {
  from: string;
  to:   string;
}

@Injectable()
export class PackageGraphService {

  build(graph: DependencyGraph): PackageEdge[] {
    const edges: PackageEdge[] = [];
    const seen  = new Set<string>();

    for (const edge of graph.edges) {
      const fromPackage = this.extractTopLevelPackage(edge.from);
      const toPackage   = this.extractTopLevelPackage(edge.to);

      // Null means the file lives directly in src/ (e.g. app.module.ts) and
      // does not belong to a named sub-package — skip it.
      if (!fromPackage || !toPackage) continue;

      // Self-edges (same package importing itself) are not useful for
      // architectural analysis.
      if (fromPackage === toPackage) continue;

      const key = `${fromPackage}->${toPackage}`;
      if (seen.has(key)) continue;

      seen.add(key);
      edges.push({ from: fromPackage, to: toPackage });
    }

    return edges;
  }

  /**
   * Returns the top-level sub-package name for a given file path
   * (the directory immediately under src/), or null if the file
   * is not inside a named sub-package.
   *
   * Examples:
   *   src/core/pipeline/foo.ts  → "core"
   *   src/app.module.ts         → null   (directly in src/)
   *   /external/lib/bar.ts      → null   (no src/ segment)
   */
  private extractTopLevelPackage(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    const parts      = normalized.split('/');
    const srcIndex   = parts.indexOf('src');

    if (srcIndex === -1) return null;

    const next = parts[srcIndex + 1];

    // A segment containing a dot is a file, not a directory
    if (!next || next.includes('.')) return null;

    return next;
  }
}