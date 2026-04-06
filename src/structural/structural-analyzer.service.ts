import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import { FileNode } from '../shared/types/file-node.type';
import { DependencyGraph, GraphEdge } from '../graph/unified-graph.types';
import {
  extractImports,
  EXT_TO_LANGUAGE,
  SupportedLanguage,
} from './import-extractor';
import { resolveImport } from './import-resolver';
import { APP_CONSTANTS } from 'src/common/constants/app.constants';

// All file extensions this analyzer understands — kept in sync with EXT_TO_LANGUAGE
const SUPPORTED_EXTENSIONS = new Set(Object.keys(EXT_TO_LANGUAGE));

// Test file patterns — excluded to prevent false dependency cycles
const TEST_PATTERNS: ReadonlyArray<(name: string) => boolean> = [
  (name) => name.includes('.test.'), // file.test.ts / .js / .py
  (name) => name.includes('.spec.'), // file.spec.ts (Jest/Jasmine)
  (name) => name.includes('_test.'), // file_test.go
  (name) => name.endsWith('_test.go'), // Go convention
  (name) => name.startsWith('test_'), // Python: test_user.py
  (name) => name === 'run-analysis.ts', // standalone test utility
];

@Injectable()
export class StructuralAnalyzerService {
  private readonly fileCache = new BoundedLRU(APP_CONSTANTS.MAX_CACHE_ENTRIES);

  analyze(fileTree: FileNode): DependencyGraph {
    const nodes = new Map<string, any>();
    const edges: GraphEdge[] = [];

    this.fileCache.clear();
    this.walk(fileTree, nodes, edges, fileTree.path);

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  private walk(
    node: FileNode,
    nodes: Map<string, any>,
    edges: GraphEdge[],
    projectRoot: string,
  ) {
    // Recurse into folders
    if (node.type === 'folder') {
      node.children?.forEach((child) => this.walk(child, nodes, edges, projectRoot));
      return;
    }

    // Skip unsupported file types
    const ext = this.getExtension(node.path);
    if (!SUPPORTED_EXTENSIONS.has(ext)) return;

    // Skip test files — they create false cross-package edges
    const fileName = node.path.split(/[/\\]/).pop() ?? '';
    if (TEST_PATTERNS.some((pattern) => pattern(fileName))) return;

    const normalizedPath = this.normalizePath(node.path);

    // Register the file as a node
    nodes.set(normalizedPath, { id: normalizedPath, type: 'file' });

    const content = this.readFileCached(node.path);
    if (!content) return;

    // Fast pre-check: skip files with no import-like statements
    if (!this.hasImports(content, ext)) return;

    // Resolve the language from the extension so extractImports uses
    // the correct pattern group instead of trying all patterns.
    const language: SupportedLanguage = EXT_TO_LANGUAGE[ext] ?? 'unknown';

    // Extract and resolve all imports
    const imports = extractImports(content, language);

    imports.forEach((imp) => {
      let resolved: string | null = null;

      // Java imports are package names, not file paths
      if (language === 'java' || language === 'kotlin') {
        resolved = this.resolveJavaImport(imp);
      } else {
        resolved = resolveImport(node.path, imp, language, projectRoot);
      }

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
   * Fast pre-check: avoids running regex extraction on files
   * that clearly have no imports in any supported language.
   *
   * Each language has a characteristic keyword that must be present
   * before we bother running the heavier pattern matching.
   */
  private hasImports(content: string, ext: string): boolean {
    switch (EXT_TO_LANGUAGE[ext]) {
      case 'typescript':
      case 'javascript':
        return content.includes('import') || content.includes('require');

      case 'python':
        return content.includes('import') || content.includes('from ');

      case 'java':
      case 'kotlin':
        return content.includes('import ');

      case 'go':
        return content.includes('import');

      case 'csharp':
        return content.includes('using ');

      case 'ruby':
        return (
          content.includes('require') ||
          content.includes('include ') ||
          content.includes('extend ')
        );

      case 'php':
        return (
          content.includes('use ') ||
          content.includes('require') ||
          content.includes('include')
        );

      case 'rust':
        return (
          content.includes('use ') ||
          content.includes('extern') ||
          content.includes('mod ')
        );

      case 'swift':
        return content.includes('import ');

      case 'scala':
        return content.includes('import ');

      case 'dart':
        return (
          content.includes('import ') ||
          content.includes('export ') ||
          content.includes('part ')
        );

      case 'elixir':
        return (
          content.includes('import ') ||
          content.includes('alias ') ||
          content.includes('use ') ||
          content.includes('require ')
        );

      case 'c':
      case 'cpp':
        return content.includes('#include');

      default:
        // Unknown extension — do a broad check
        return (
          content.includes('import') ||
          content.includes('require') ||
          content.includes('#include') ||
          content.includes(' from ') ||
          content.includes('using ')
        );
    }
  }

  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot === -1 ? '' : filePath.slice(lastDot).toLowerCase();
  }

  private normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
  }

  private readFileCached(filePath: string): string | null {
    const cached = this.fileCache.get(filePath);
    if (cached !== undefined) return cached;

    try {
      const stats = fs.statSync(filePath);
      // Skip files larger than MAX_FILE_SIZE_BYTES — minified bundles,
      // auto-generated lock files, and binary assets bloat the cache and
      // produce zero useful import edges.
      if (stats.size > APP_CONSTANTS.MAX_FILE_SIZE_BYTES) return null;

      const content = fs.readFileSync(filePath, 'utf-8');
      this.fileCache.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  }
  private resolveJavaImport(pkg: string): string | null {
    // Ignore external libraries
    if (
      !pkg.startsWith('com.') &&
      !pkg.startsWith('org.') &&
      !pkg.startsWith('net.')
    ) {
      return null;
    }

    const parts = pkg.split('.');

    if (parts.length < 2) return null;

    // module name is second last segment
    const module = parts[parts.length - 2];

    return module;
  }
}

// ─── Minimal O(1) LRU implementation ──────────────────────────────────────

class BoundedLRU {
  private readonly map = new Map<string, string>();

  constructor(private readonly maxSize: number) {}

  get(key: string): string | undefined {
    const val = this.map.get(key);
    if (val === undefined) return undefined;
    // Move to end (most-recently-used)
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: string, value: string): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      // Evict least-recently-used (first entry)
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }
}
