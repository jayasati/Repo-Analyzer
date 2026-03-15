import { UnifiedGraph, GraphEdge, GraphNode } from '../graph/unified-graph.types';
import { Injectable } from '@nestjs/common';

export interface DiagramGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Same constants as PackageGraphService (kept local to avoid circular imports) ──

const SKIP_SEGMENTS = new Set([
  'main', 'test', 'tests', 'it',
  'java', 'kotlin', 'scala', 'groovy',
  'resources', 'webapp',
  'python', 'lib', 'libs',
  'app', 'src', 'source',
]);

const DOMAIN_SEGMENTS = new Set([
  'com', 'org', 'io', 'net', 'edu', 'gov', 'co', 'me', 'dev',
  'github', 'gitlab', 'bitbucket',
  'google', 'microsoft', 'amazon', 'apache', 'eclipse',
  'spring', 'springframework', 'springboot',
]);

const TOPLEVEL_NAMESPACE_DIRS = new Set([
  'internal', 'pkg', 'cmd', 'api', 'handler', 'handlers',
  'service', 'services', 'repository', 'repositories',
  'controller', 'controllers', 'domain', 'usecase', 'usecases',
  'infrastructure', 'adapter', 'adapters', 'module', 'modules',
]);

const JAVA_STYLE_EXTS = new Set([
  '.java', '.kt', '.kts', '.scala', '.groovy', '.clj',
]);

@Injectable()
export class DiagramPrepService {

  forClassDiagram(graph: UnifiedGraph): DiagramGraph {
    const edges = this.normalizeEdges(
      graph.edges.filter(e => e.type === 'constructor-injection')
    );
    const nodeIds = new Set(edges.flatMap(e => [e.from, e.to]));
    const nodes = graph.nodes
      .filter(n =>
        nodeIds.has(this.normalizeId(n.id)) &&
        ['controller', 'service', 'class'].includes(n.type)
      )
      .map(n => ({ ...n, id: this.normalizeId(n.id) }));
    return { nodes, edges };
  }

  forComponentDiagram(graph: UnifiedGraph): DiagramGraph {
    const moduleNodes = graph.nodes.filter(n => n.type === 'module');
    if (moduleNodes.length > 0) {
      return this.buildSemanticComponentDiagram(graph, moduleNodes);
    }
    return this.buildPackageComponentDiagram(graph);
  }

  private buildSemanticComponentDiagram(graph: UnifiedGraph, moduleNodes: GraphNode[]): DiagramGraph {
    const moduleIds = new Set(moduleNodes.map(n => this.normalizeModuleId(n.id)));
    const edges = this.normalizeEdges(
      graph.edges.filter(e => e.type.startsWith('module-'))
    ).filter(e =>
      moduleIds.has(this.normalizeModuleId(e.from)) &&
      moduleIds.has(this.normalizeModuleId(e.to))
    );
    const nodes = moduleNodes.map(n => ({ ...n, id: this.normalizeModuleId(n.id) }));
    return { nodes, edges };
  }

  private buildPackageComponentDiagram(graph: UnifiedGraph): DiagramGraph {
    const packages = new Set<string>();
    for (const node of graph.nodes) {
      const pkg = this.extractTopLevelPackage(node.id);
      if (pkg) packages.add(pkg);
    }
    const seen = new Set<string>();
    const edges: GraphEdge[] = [];
    for (const edge of graph.edges) {
      if (edge.type !== 'import') continue;
      const from = this.extractTopLevelPackage(edge.from);
      const to   = this.extractTopLevelPackage(edge.to);
      if (!from || !to || from === to) continue;
      const key = `${from}->${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to, type: 'import' });
    }
    const nodes: GraphNode[] = Array.from(packages).map(pkg => ({
      id: pkg, type: 'module' as const, source: 'structural' as const,
    }));
    return { nodes, edges };
  }

  forSequenceDiagram(graph: UnifiedGraph, entryPoint: string, maxDepth = 3): DiagramGraph {
    const edges = this.normalizeEdges(
      graph.edges.filter(e => e.type === 'constructor-injection')
    );
    const visited = new Set<string>();
    const resultEdges: GraphEdge[] = [];
    const walk = (node: string, depth: number) => {
      if (depth > maxDepth || visited.has(node)) return;
      visited.add(node);
      edges.filter(e => e.from === node).forEach(e => {
        resultEdges.push(e);
        walk(e.to, depth + 1);
      });
    };
    walk(this.normalizeId(entryPoint), 0);
    const seenIds = new Set<string>();
    const nodes = graph.nodes
      .filter(n => visited.has(this.normalizeId(n.id)))
      .map(n => ({ ...n, id: this.normalizeId(n.id) }))
      .filter(n => { if (seenIds.has(n.id)) return false; seenIds.add(n.id); return true; });
    return { nodes, edges: resultEdges };
  }

  resolveSequenceEntryPoint(graph: UnifiedGraph): string | null {
    const controller = graph.nodes.find(n => n.type === 'controller');
    if (controller) return controller.id;
    const injectionFromIds = new Set(
      graph.edges.filter(e => e.type === 'constructor-injection').map(e => e.from)
    );
    const rootClass = graph.nodes.find(n => n.type === 'class' && injectionFromIds.has(n.id));
    if (rootClass) return rootClass.id;
    const anyClass = graph.nodes.find(n => n.type === 'class');
    if (anyClass) return anyClass.id;
    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private normalizeId(id: string): string {
    if (id.includes('import(')) {
      const match = id.match(/\.([A-Za-z0-9_]+)\)?$/);
      return match ? match[1] : id;
    }
    if (id.includes('/') || id.includes('\\')) {
      return id.split(/[/\\]/).pop()!
        .replace(/\.(ts|tsx|js|jsx|java|kt|kts|scala|py|go|rb|php|rs|cs)$/, '');
    }
    return id;
  }

  private normalizeModuleId(id: string): string {
    const base = this.normalizeId(id);
    if (/^[A-Z]/.test(base)) return base;
    return base.split(/[-.]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  }

  /** Fixed multi-language implementation — mirrors PackageGraphService. */
  private extractTopLevelPackage(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    const parts      = normalized.split('/').filter(p => p.length > 0);

    const fileName   = parts[parts.length - 1] ?? '';
    const dotIdx     = fileName.lastIndexOf('.');
    const ext        = dotIdx >= 0 ? fileName.slice(dotIdx).toLowerCase() : '';
    const isJavaLike = JAVA_STYLE_EXTS.has(ext);

    const srcIndex = parts.indexOf('src');

    if (srcIndex !== -1) {
      return isJavaLike
        ? this.lastMeaningfulDir(parts, srcIndex + 1, parts.length - 1)
        : this.firstMeaningfulDir(parts, srcIndex + 1, parts.length - 1);
    }

    for (let i = 0; i < parts.length - 1; i++) {
      if (TOPLEVEL_NAMESPACE_DIRS.has(parts[i])) {
        const next = parts[i + 1];
        if (next && !next.includes('.')) return next;
      }
    }

    return this.firstMeaningfulDir(parts, 0, parts.length - 1);
  }

  private firstMeaningfulDir(parts: string[], start: number, end: number): string | null {
    for (let i = start; i < end; i++) {
      const seg = parts[i];
      if (seg.includes('.'))                       return null;
      if (SKIP_SEGMENTS.has(seg))                  continue;
      if (DOMAIN_SEGMENTS.has(seg.toLowerCase()))  continue;
      return seg;
    }
    return null;
  }

  private lastMeaningfulDir(parts: string[], start: number, end: number): string | null {
    for (let i = end - 1; i >= start; i--) {
      const seg = parts[i];
      if (seg.includes('.'))                       continue;
      if (SKIP_SEGMENTS.has(seg))                  continue;
      if (DOMAIN_SEGMENTS.has(seg.toLowerCase()))  continue;
      return seg;
    }
    return null;
  }

  private isValidNode(id: string): boolean {
    if (['string', 'number', 'boolean', 'any', 'unknown', 'void'].includes(id)) return false;
    if (['@nestjs', 'fs', 'path', 'rxjs'].some(p => id.startsWith(p))) return false;
    return true;
  }

  private normalizeEdges(edges: GraphEdge[]): GraphEdge[] {
    return edges
      .map(e => ({ ...e, from: this.normalizeId(e.from), to: this.normalizeId(e.to) }))
      .filter(e => this.isValidNode(e.from) && this.isValidNode(e.to));
  }
}
