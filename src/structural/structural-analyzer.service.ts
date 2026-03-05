import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import { FileNode } from '../core/types/file-node.type';
import { DependencyGraph } from '../graph/unified-graph.types';
import { extractImports } from './import-extractor';
import { GraphEdge } from '../graph/unified-graph.types';
import { resolveImport } from './import-resolver';

@Injectable()
export class StructuralAnalyzerService {
  analyze(fileTree: FileNode): DependencyGraph {
    const nodes = new Map<string, any>();
    const edges: GraphEdge[] = [];

    this.walk(fileTree, nodes, edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  private walk(
    node: FileNode,
    nodes: Map<string, any>,
    edges: GraphEdge[],
  ) {
    if (node.type === 'folder') {
      node.children?.forEach(child =>
        this.walk(child, nodes, edges)
      );
      return;
    }

    if (!node.path.endsWith('.ts') && !node.path.endsWith('.js')) {
      return;
    }

    const normalized = this.normalizePath(node.path);
    nodes.set(normalized, {
      id: normalized,
      type: 'file',
    });

    try {
      const content = fs.readFileSync(node.path, 'utf-8');
      const imports = extractImports(content);

      imports.forEach(imp => {

        const resolved = resolveImport(node.path, imp);

        if (!resolved) return;

        nodes.set(resolved, {
          id: resolved,
          type: 'file',
        });

        edges.push({
          from: this.normalizePath(node.path),
          to: this.normalizePath(resolved),
          type: 'import',
        });
      });
    } catch {}
  }
}
