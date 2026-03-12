import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import { FileNode } from '../shared/types/file-node.type';
import { DependencyGraph, GraphEdge } from '../graph/unified-graph.types';
import { extractImports } from './import-extractor';
import { resolveImport } from './import-resolver';

// All file extensions this analyzer understands
const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx',         // TypeScript
  '.js', '.jsx', '.mjs', // JavaScript
  '.py',                 // Python
  '.java',               // Java
  '.go',                 // Go
  '.rs',                 // Rust
  '.cpp', '.cc', '.cxx', // C++
  '.c',                  // C
  '.cs',                 // C#
]);

// Test file patterns — excluded to prevent false dependency cycles
const TEST_PATTERNS : ReadonlyArray<(name: string) => boolean> =[
  (name: string) => name.includes('.test.'),   // file.test.ts / .js / .py
  (name: string) => name.includes('.spec.'),   // file.spec.ts (Jest/Jasmine)
  (name: string) => name.includes('_test.'),   // file_test.go
  (name: string) => name.endsWith('_test.go'), // Go convention
  (name: string) => name.startsWith('test_'),  // Python: test_user.py
  (name: string) => name === 'run-analysis.ts',// standalone test utility
];

@Injectable()
export class StructuralAnalyzerService {

  private fileCache = new Map<string, string>();

  analyze(fileTree: FileNode): DependencyGraph {
    const nodes = new Map<string, any>();
    const edges: GraphEdge[] = [];

    this.fileCache.clear();
    this.walk(fileTree, nodes, edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  private walk(node: FileNode, nodes: Map<string, any>, edges: GraphEdge[]) {

    // Recurse into folders
    if (node.type === 'folder') {
      node.children?.forEach(child => this.walk(child, nodes, edges));
      return;
    }

    // Skip unsupported file types
    const ext = this.getExtension(node.path);
    if (!SUPPORTED_EXTENSIONS.has(ext)) return;

    // Skip test files — they create false cross-package edges
    const fileName = node.path.split(/[\\/]/).pop() ?? '';
    if (TEST_PATTERNS.some(pattern => pattern(fileName))) return;

    const normalizedPath = this.normalizePath(node.path);

    // Register the file as a node
    nodes.set(normalizedPath, { id: normalizedPath, type: 'file' });

    const content = this.readFileCached(node.path);
    if (!content) return;

    // Fast pre-check: skip files with no import-like statements
    if (!this.hasImports(content)) return;

    // Extract and resolve all imports
    const imports = extractImports(content);

    imports.forEach(imp => {
      const resolved = resolveImport(node.path, imp);
      if (!resolved) return;

      const normalizedResolved = this.normalizePath(resolved);

      nodes.set(normalizedResolved, { id: normalizedResolved, type: 'file' });

      edges.push({
        from: normalizedPath,
        to: normalizedResolved,
        type: 'import',
      });
    });
  }

  /**
   * Fast pre-check to avoid running regex extraction on files
   * that clearly have no imports in any supported language.
   */
  private hasImports(content: string): boolean {
    return (
      content.includes('import')   ||  // TS/JS/Python/Java/Go
      content.includes('require')  ||  // CommonJS
      content.includes('#include') ||  // C / C++
      content.includes(' from ')   ||  // ES modules / Python
      content.includes('using ')       // C#
    );
  }

  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot === -1 ? '' : filePath.slice(lastDot).toLowerCase();
  }

  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  private readFileCached(filePath: string): string | null {
    if (this.fileCache.has(filePath)) return this.fileCache.get(filePath)!;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.fileCache.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  }
}