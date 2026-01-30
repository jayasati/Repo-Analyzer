import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import { FileNode } from '../core/types/file-node.type';
import { DependencyGraph } from '../graph/graph.types';
import { extractImports } from './import-extractor';

@Injectable()
export class StructuralAnalyzerService {

  analyze(fileTree: FileNode): DependencyGraph {
    const nodes = new Map<string, any>();
    const edges: { from: string; to: string }[] = [];

    this.walk(fileTree, nodes, edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  private walk(
    node: FileNode,
    nodes: Map<string, any>,
    edges: { from: string; to: string }[],
  ) {
    // ✅ Always traverse folders
    if (node.type === 'folder') {
      node.children?.forEach(child =>
        this.walk(child, nodes, edges)
      );
      return;
    }
    
    if (!node.path.endsWith('.ts') && !node.path.endsWith('.js')) {
        return;
    }

    if (node.type === 'file') {
      nodes.set(node.path, {
        id: node.path,
        type: 'file',
      });

      try {
        const content = fs.readFileSync(node.path, 'utf-8');
        const imports = extractImports(content);

        imports.forEach(imp => {
          edges.push({
            from: node.path,
            to: imp,
          });
        });
      } catch {
        // Ignore binary / unreadable files
      }
    }

    node.children?.forEach(child =>
      this.walk(child, nodes, edges)
    );
  }
}
