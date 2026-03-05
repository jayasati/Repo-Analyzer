import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import { FileNode } from '../core/types/file-node.type';
import { DependencyGraph, GraphEdge } from '../graph/unified-graph.types';
import { extractImports } from './import-extractor';
import { resolveImport } from './import-resolver';

@Injectable()
export class StructuralAnalyzerService {

  // Cache to avoid repeated disk reads
  private fileCache = new Map<string, string>();

  analyze(fileTree: FileNode): DependencyGraph {

    const nodes = new Map<string, any>();
    const edges: GraphEdge[] = [];

    // clear cache for fresh analysis
    this.fileCache.clear();

    this.walk(fileTree, nodes, edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
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

    // Only analyze JS/TS files
    if (!node.path.endsWith('.ts') && !node.path.endsWith('.js')) {
      return;
    }

    const normalizedPath = this.normalizePath(node.path);

    // Register file node
    nodes.set(normalizedPath, {
      id: normalizedPath,
      type: 'file',
    });

    const content = this.readFileCached(node.path);

    if (!content) return;

    const imports = extractImports(content);

    imports.forEach(imp => {

      const resolved = resolveImport(node.path, imp);

      if (!resolved) return;

      const normalizedResolved = this.normalizePath(resolved);

      // ensure target node exists
      nodes.set(normalizedResolved, {
        id: normalizedResolved,
        type: 'file',
      });

      edges.push({
        from: normalizedPath,
        to: normalizedResolved,
        type: 'import',
      });

    });

  }

  /**
   * Normalize paths to use forward slashes
   * Prevents Windows/Linux duplication issues
   */
  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  /**
   * Cached file reader to reduce disk I/O
   */
  private readFileCached(filePath: string): string | null {

    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    try {

      const content = fs.readFileSync(filePath, 'utf-8');

      this.fileCache.set(filePath, content);

      return content;

    } catch {

      return null;

    }

  }

}