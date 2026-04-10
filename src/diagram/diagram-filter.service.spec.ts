import { DiagramFilterService } from './diagram-filter.service';
import { UnifiedGraph } from '../graph/unified-graph.types';

describe('DiagramFilterService', () => {
  let service: DiagramFilterService;

  beforeEach(() => {
    service = new DiagramFilterService();
  });

  const makeGraph = (
    nodeIds: string[],
    edges: Array<{ from: string; to: string }>,
  ): UnifiedGraph => ({
    nodes: nodeIds.map((id) => ({ id, type: 'class', source: 'structural' as const })),
    edges: edges.map((e) => ({ ...e, type: 'import' as const })),
  });

  it('removes 3rd-party nodes', () => {
    const graph = makeGraph(
      ['UserService', '@nestjs/common', 'rxjs/Observable'],
      [
        { from: 'UserService', to: '@nestjs/common' },
        { from: 'UserService', to: 'rxjs/Observable' },
      ],
    );

    const result = service.filter(graph);
    expect(result.nodes.map((n) => n.id)).toEqual(['UserService']);
    expect(result.edges).toHaveLength(0);
  });

  it('removes test/spec files', () => {
    const graph = makeGraph(
      ['UserService', 'user.spec.ts', 'jest.config.ts'],
      [],
    );

    const result = service.filter(graph);
    expect(result.nodes.map((n) => n.id)).toEqual(['UserService']);
  });

  it('filters self-loop edges', () => {
    const graph = makeGraph(['A', 'B'], [{ from: 'A', to: 'A' }, { from: 'A', to: 'B' }]);
    const result = service.filter(graph);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].from).toBe('A');
    expect(result.edges[0].to).toBe('B');
  });

  it('limits to maxNodes by degree centrality', () => {
    // Node C has highest degree (connected to A, B, D)
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        { from: 'A', to: 'C' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'D' },
      ],
    );

    const result = service.filter(graph, { maxNodes: 3 });
    expect(result.nodes.length).toBeLessThanOrEqual(3);
    // C should definitely be included (highest degree)
    expect(result.nodes.map((n) => n.id)).toContain('C');
  });

  it('focuses on a specific module via BFS', () => {
    const graph = makeGraph(
      ['A', 'B', 'C', 'D', 'E'],
      [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'D' },
        { from: 'D', to: 'E' },
      ],
    );

    const result = service.filter(graph, {
      focusModule: 'B',
      focusDepth: 1,
    });

    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain('B');
    expect(ids).toContain('A'); // 1 hop away
    expect(ids).toContain('C'); // 1 hop away
    expect(ids).not.toContain('D'); // 2 hops away
    expect(ids).not.toContain('E'); // 3 hops away
  });

  it('filters by minimum degree', () => {
    const graph = makeGraph(
      ['Hub', 'A', 'B', 'C', 'Orphan'],
      [
        { from: 'A', to: 'Hub' },
        { from: 'B', to: 'Hub' },
        { from: 'Hub', to: 'C' },
      ],
    );

    const result = service.filter(graph, { minDegree: 2 });
    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain('Hub'); // degree 3
    expect(ids).not.toContain('Orphan'); // degree 0
  });

  it('returns empty graph when all nodes are noise', () => {
    const graph = makeGraph(
      ['@nestjs/common', 'index.ts', 'main.ts'],
      [],
    );

    const result = service.filter(graph);
    expect(result.nodes).toHaveLength(0);
  });

  it('preserves original graph when no filtering needed', () => {
    const graph = makeGraph(
      ['UserService', 'OrderService'],
      [{ from: 'UserService', to: 'OrderService' }],
    );

    const result = service.filter(graph, { maxNodes: 100 });
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });
});
