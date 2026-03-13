import { UnifiedGraph, GraphEdge, GraphNode } from '../graph/unified-graph.types';
import { Injectable } from '@nestjs/common';

export interface DiagramGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

@Injectable()
export class DiagramPrepService {

  // ========================
  // CLASS DIAGRAM
  // ========================
  forClassDiagram(graph: UnifiedGraph): DiagramGraph {
    const edges = this.normalizeEdges(
      graph.edges.filter(e => e.type === 'constructor-injection')
    );

    const nodeIds = new Set(
      edges.flatMap(e => [e.from, e.to])
    );

    const nodes = graph.nodes
      .filter(n =>
        nodeIds.has(this.normalizeId(n.id)) &&
        ['controller', 'service', 'class'].includes(n.type)
      )
      .map(n => ({
        ...n,
        id: this.normalizeId(n.id),
      }));

    return { nodes, edges };
  }

  // ========================
  // COMPONENT DIAGRAM
  // ========================
  /**
   * Framework-agnostic component diagram.
   *
   * Strategy: use the structural import edges and group every file node
   * by its top-level package (the directory immediately under src/).
   * This works for any language or framework because it relies only on
   * directory structure — not on naming conventions like 'Module' or
   * file suffixes like '.module.ts'.
   *
   * For NestJS projects that have semantic module nodes, those are also
   * included and take display priority over the file-path derived names.
   *
   * Example (NestJS):
   *   src/core/analyzer.service.ts  → package 'core'
   *   src/api/analyze.controller.ts → package 'api'
   *   edge: core → api (if core imports api)
   *
   * Example (Django):
   *   src/users/views.py  → package 'users'
   *   src/orders/urls.py  → package 'orders'
   *   edge: orders → users (if orders imports users)
   */
  forComponentDiagram(graph: UnifiedGraph): DiagramGraph {
    // ── Step 1: Try NestJS semantic module nodes first ──────────────────────
    // If the semantic analyzer has already identified typed module nodes,
    // use those — they carry richer information.
    const semanticModuleNodes = graph.nodes.filter(n => n.type === 'module');

    if (semanticModuleNodes.length > 0) {
      return this.buildSemanticComponentDiagram(graph, semanticModuleNodes);
    }

    // ── Step 2: Fall back to package-based grouping (framework-agnostic) ───
    return this.buildPackageComponentDiagram(graph);
  }

  // ========================
  // SEQUENCE DIAGRAM
  // ========================
  forSequenceDiagram(
    graph: UnifiedGraph,
    entryPoint: string,
    maxDepth = 3,
  ): DiagramGraph {
    const edges = this.normalizeEdges(
      graph.edges.filter(e => e.type === 'constructor-injection')
    );

    const visited     = new Set<string>();
    const resultEdges: GraphEdge[] = [];

    const walk = (node: string, depth: number) => {
      if (depth > maxDepth || visited.has(node)) return;
      visited.add(node);

      edges
        .filter(e => e.from === node)
        .forEach(e => {
          resultEdges.push(e);
          walk(e.to, depth + 1);
        });
    };

    walk(this.normalizeId(entryPoint), 0);

    const seenIds = new Set<string>();
    const nodes = graph.nodes
      .filter(n => visited.has(this.normalizeId(n.id)))
      .map(n => ({ ...n, id: this.normalizeId(n.id) }))
      .filter(n => {
        if (seenIds.has(n.id)) return false;
        seenIds.add(n.id);
        return true;
      });

    return { nodes, edges: resultEdges };
  }

  // ========================
  // PRIVATE — COMPONENT DIAGRAM STRATEGIES
  // ========================

  /**
   * NestJS path: uses typed 'module' nodes from the semantic analyzer.
   * Accepts both explicit module-* edges and structural import edges
   * whose both endpoints resolve to known module class names.
   */
  private buildSemanticComponentDiagram(
    graph: UnifiedGraph,
    moduleNodes: GraphNode[],
  ): DiagramGraph {
    const moduleClassNames = new Set(
      moduleNodes.map(n => this.normalizeModuleId(n.id))
    );

    const rawEdges = graph.edges.filter(e => {
      const from = this.normalizeModuleId(e.from);
      const to   = this.normalizeModuleId(e.to);
      return (
        (e.type.startsWith('module-') || e.type === 'import') &&
        moduleClassNames.has(from) &&
        moduleClassNames.has(to) &&
        from !== to
      );
    });

    const edges = this.deduplicateEdges(
      rawEdges.map(e => ({
        ...e,
        from: this.normalizeModuleId(e.from),
        to:   this.normalizeModuleId(e.to),
      }))
    );

    const nodes = moduleNodes
      .map(n => ({ ...n, id: this.normalizeModuleId(n.id) }))
      .filter((n, i, self) => self.findIndex(x => x.id === n.id) === i);

    return { nodes, edges };
  }

  /**
   * Framework-agnostic path: derives component nodes from the top-level
   * package directory of each file (the folder immediately under src/).
   * Works for Python, Java, Go, plain JS/TS — anything with a src/ layout.
   */
  private buildPackageComponentDiagram(graph: UnifiedGraph): DiagramGraph {
    // Map every file node to its top-level package name
    const fileToPackage = new Map<string, string>();

    for (const node of graph.nodes) {
      if (node.type !== 'file') continue;
      const pkg = this.extractTopLevelPackage(node.id);
      if (pkg) fileToPackage.set(node.id, pkg);
    }

    // Build deduplicated package-level edges from structural imports
    const packageEdges: GraphEdge[] = [];
    const seen = new Set<string>();

    for (const edge of graph.edges) {
      if (edge.type !== 'import') continue;

      const fromPkg = fileToPackage.get(edge.from);
      const toPkg   = fileToPackage.get(edge.to);

      if (!fromPkg || !toPkg || fromPkg === toPkg) continue;

      const key = `${fromPkg}->${toPkg}`;
      if (seen.has(key)) continue;
      seen.add(key);

      packageEdges.push({ from: fromPkg, to: toPkg, type: 'import' });
    }

    // Build synthetic package nodes for every package that appears in an edge
    const packageNames = new Set(
      packageEdges.flatMap(e => [e.from, e.to])
    );

    const nodes: GraphNode[] = Array.from(packageNames).map(name => ({
      id:     name,
      type:   'module',
      source: 'structural',
    }));

    return { nodes, edges: packageEdges };
  }

  // ========================
  // PRIVATE — HELPERS
  // ========================

  /**
   * General-purpose id normaliser used for class/sequence diagrams.
   */
  private normalizeId(id: string): string {
    if (id.includes('import(')) {
      const match = id.match(/\.([A-Za-z0-9_]+)\)?$/);
      return match ? match[1] : id;
    }

    if (id.includes('/') || id.includes('\\')) {
      return id.split(/[\\/]/).pop()!.replace(/\.(ts|js)$/, '');
    }

    return id;
  }

  /**
   * Module-specific id normaliser — NestJS only.
   * Converts file-path-based ids to PascalCase class names.
   *
   * 'core.module'           → 'CoreModule'
   * 'local-scanner.module'  → 'LocalScannerModule'
   * 'CoreModule'            → 'CoreModule'  (already a class name)
   */
  private normalizeModuleId(id: string): string {
    const base = this.normalizeId(id);

    if (base.endsWith('.module')) {
      const prefix = base.slice(0, -'.module'.length);
      const pascal = prefix
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      return `${pascal}Module`;
    }

    return base;
  }

  /**
   * Extracts the top-level package name (directory immediately under src/).
   * Returns null for files sitting directly in src/ or outside it.
   *
   * 'src/core/pipeline/foo.ts'  → 'core'
   * 'src/app.module.ts'         → null
   */
  private extractTopLevelPackage(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    const parts      = normalized.split('/');
    const srcIndex   = parts.indexOf('src');

    if (srcIndex === -1) return null;

    const next = parts[srcIndex + 1];
    if (!next || next.includes('.')) return null;

    return next;
  }

  private isValidNode(id: string): boolean {
    if (['string', 'number', 'boolean', 'any', 'unknown', 'void'].includes(id))
      return false;

    if (['@nestjs', 'fs', 'path', 'rxjs'].some(p => id.startsWith(p)))
      return false;

    return true;
  }

  private normalizeEdges(edges: GraphEdge[]): GraphEdge[] {
    return edges
      .map(e => ({
        ...e,
        from: this.normalizeId(e.from),
        to:   this.normalizeId(e.to),
      }))
      .filter(e =>
        this.isValidNode(e.from) &&
        this.isValidNode(e.to)
      );
  }

  private deduplicateEdges(edges: GraphEdge[]): GraphEdge[] {
    const seen = new Set<string>();
    return edges.filter(e => {
      const key = `${e.from}->${e.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}