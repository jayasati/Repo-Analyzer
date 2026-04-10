import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import type { UnifiedGraph, GraphNode, GraphEdge } from '../graph/unified-graph.types';

// ── Response types ──────────────────────────────────────────────────────────────

interface ModuleInfo {
  id: string;
  type: string;
  filePath?: string;
  fanIn: number;
  fanOut: number;
}

interface DependencyResult {
  module: string;
  direction: 'outgoing' | 'incoming';
  dependencies: Array<{ id: string; type: string; edgeType: string }>;
}

interface PathResult {
  from: string;
  to: string;
  path: string[] | null;
  length: number;
}

interface ImpactResult {
  module: string;
  depth: number;
  affected: ModuleInfo[];
}

interface GraphSummary {
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  topFanOut: ModuleInfo[];
  topFanIn: ModuleInfo[];
}

// ── Controller ──────────────────────────────────────────────────────────────────

@ApiTags('graph')
@Controller('graph')
export class GraphController {
  constructor(private readonly cache: AnalysisCacheService) {}

  private async getGraph(jobId: string): Promise<UnifiedGraph> {
    const result = await this.cache.get(jobId);
    if (!result) throw new NotFoundException(`Analysis ${jobId} not found`);
    return result.unifiedGraph;
  }

  // ── GET /graph/:jobId ────────────────────────────────────────────────────

  @Get(':jobId')
  @ApiOperation({ summary: 'Get graph summary statistics' })
  async getSummary(@Param('jobId') jobId: string): Promise<GraphSummary> {
    const graph = await this.getGraph(jobId);
    const { fanIn, fanOut } = computeDegrees(graph);

    const nodesByType: Record<string, number> = {};
    for (const n of graph.nodes) {
      nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
    }

    const edgesByType: Record<string, number> = {};
    for (const e of graph.edges) {
      edgesByType[e.type] = (edgesByType[e.type] ?? 0) + 1;
    }

    const modules = buildModuleInfoList(graph, fanIn, fanOut);
    const topFanOut = [...modules].sort((a, b) => b.fanOut - a.fanOut).slice(0, 10);
    const topFanIn = [...modules].sort((a, b) => b.fanIn - a.fanIn).slice(0, 10);

    return {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodesByType,
      edgesByType,
      topFanOut,
      topFanIn,
    };
  }

  // ── GET /graph/:jobId/dependencies ───────────────────────────────────────

  @Get(':jobId/dependencies')
  @ApiOperation({ summary: 'Get outgoing dependencies of a module' })
  @ApiQuery({ name: 'module', required: true })
  async getDependencies(
    @Param('jobId') jobId: string,
    @Query('module') module: string,
  ): Promise<DependencyResult> {
    const graph = await this.getGraph(jobId);
    const deps = graph.edges
      .filter((e) => e.from === module || normalizeId(e.from) === module)
      .map((e) => {
        const target = graph.nodes.find((n) => n.id === e.to);
        return { id: e.to, type: target?.type ?? 'unknown', edgeType: e.type };
      });

    return { module, direction: 'outgoing', dependencies: deps };
  }

  // ── GET /graph/:jobId/dependents ─────────────────────────────────────────

  @Get(':jobId/dependents')
  @ApiOperation({ summary: 'Get incoming dependents of a module' })
  @ApiQuery({ name: 'module', required: true })
  async getDependents(
    @Param('jobId') jobId: string,
    @Query('module') module: string,
  ): Promise<DependencyResult> {
    const graph = await this.getGraph(jobId);
    const deps = graph.edges
      .filter((e) => e.to === module || normalizeId(e.to) === module)
      .map((e) => {
        const source = graph.nodes.find((n) => n.id === e.from);
        return { id: e.from, type: source?.type ?? 'unknown', edgeType: e.type };
      });

    return { module, direction: 'incoming', dependencies: deps };
  }

  // ── GET /graph/:jobId/path ───────────────────────────────────────────────

  @Get(':jobId/path')
  @ApiOperation({ summary: 'Find shortest path between two modules' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  async findPath(
    @Param('jobId') jobId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<PathResult> {
    const graph = await this.getGraph(jobId);
    const path = bfsPath(graph, from, to);
    return {
      from,
      to,
      path,
      length: path ? path.length - 1 : -1,
    };
  }

  // ── GET /graph/:jobId/impact ─────────────────────────────────────────────

  @Get(':jobId/impact')
  @ApiOperation({ summary: 'Compute impact radius — what breaks if this module changes' })
  @ApiQuery({ name: 'module', required: true })
  @ApiQuery({ name: 'depth', required: false, type: Number })
  async getImpact(
    @Param('jobId') jobId: string,
    @Query('module') module: string,
    @Query('depth') depth = 3,
  ): Promise<ImpactResult> {
    const graph = await this.getGraph(jobId);
    const { fanIn, fanOut } = computeDegrees(graph);

    // Impact = reverse BFS — who depends on this module, transitively?
    const affected = reverseTransitiveClosure(graph, module, Number(depth));
    const modules = buildModuleInfoList(graph, fanIn, fanOut);
    const affectedInfo = modules.filter((m) => affected.has(m.id));

    return { module, depth: Number(depth), affected: affectedInfo };
  }

  // ── GET /graph/:jobId/modules ────────────────────────────────────────────

  @Get(':jobId/modules')
  @ApiOperation({ summary: 'List all modules with fan-in/fan-out stats' })
  @ApiQuery({ name: 'sort', required: false, enum: ['fanIn', 'fanOut', 'id'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listModules(
    @Param('jobId') jobId: string,
    @Query('sort') sort = 'fanOut',
    @Query('limit') limit = 50,
  ): Promise<ModuleInfo[]> {
    const graph = await this.getGraph(jobId);
    const { fanIn, fanOut } = computeDegrees(graph);
    let modules = buildModuleInfoList(graph, fanIn, fanOut);

    if (sort === 'fanIn') modules.sort((a, b) => b.fanIn - a.fanIn);
    else if (sort === 'fanOut') modules.sort((a, b) => b.fanOut - a.fanOut);
    else modules.sort((a, b) => a.id.localeCompare(b.id));

    return modules.slice(0, Number(limit));
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function normalizeId(id: string): string {
  if (id.includes('/') || id.includes('\\')) {
    return id
      .split(/[/\\]/)
      .pop()!
      .replace(/\.(ts|tsx|js|jsx|java|kt|kts|scala|py|go|rb|php|rs|cs)$/, '');
  }
  return id;
}

function computeDegrees(graph: UnifiedGraph) {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const e of graph.edges) {
    fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
    fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);
  }
  return { fanIn, fanOut };
}

function buildModuleInfoList(
  graph: UnifiedGraph,
  fanIn: Map<string, number>,
  fanOut: Map<string, number>,
): ModuleInfo[] {
  return graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    filePath: n.filePath,
    fanIn: fanIn.get(n.id) ?? 0,
    fanOut: fanOut.get(n.id) ?? 0,
  }));
}

/** BFS to find shortest path from `from` to `to` in directed graph. */
function bfsPath(graph: UnifiedGraph, from: string, to: string): string[] | null {
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue = [from];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) {
      // Reconstruct path
      const path: string[] = [];
      let node: string | undefined = to;
      while (node) {
        path.unshift(node);
        node = parent.get(node);
      }
      return path;
    }
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
}

/** Reverse BFS — find all nodes that transitively depend on `target`. */
function reverseTransitiveClosure(
  graph: UnifiedGraph,
  target: string,
  maxDepth: number,
): Set<string> {
  // Build reverse adjacency: who depends on each node?
  const reverseAdj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!reverseAdj.has(e.to)) reverseAdj.set(e.to, []);
    reverseAdj.get(e.to)!.push(e.from);
  }

  const affected = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: target, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth > maxDepth) continue;

    for (const dep of reverseAdj.get(id) ?? []) {
      if (!affected.has(dep)) {
        affected.add(dep);
        queue.push({ id: dep, depth: depth + 1 });
      }
    }
  }

  return affected;
}
