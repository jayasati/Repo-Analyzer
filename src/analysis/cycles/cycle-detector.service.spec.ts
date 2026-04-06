import { CycleDetectorService } from './cycle-detector.service';

describe('CycleDetectorService', () => {
  let svc: CycleDetectorService;
  beforeEach(() => {
    svc = new CycleDetectorService();
  });

  it('returns empty array for no edges', () => {
    expect(svc.detect([])).toEqual([]);
  });

  it('returns empty array for acyclic graph', () => {
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ];
    expect(svc.detect(edges)).toHaveLength(0);
  });

  it('detects a simple 2-node cycle', () => {
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ];
    const cycles = svc.detect(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].nodes).toHaveLength(2);
    expect(cycles[0].nodes).toEqual(expect.arrayContaining(['A', 'B']));
  });

  it('detects a 3-node cycle', () => {
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
    ];
    const cycles = svc.detect(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].nodes).toHaveLength(3);
  });

  it('does not crash on a deep linear chain (stack overflow test)', () => {
    // The recursive version crashes at ~10 000 frames on Node.js.
    // 20 000 nodes ensures the iterative version works where recursive fails.
    const N = 20_000;
    const edges = Array.from({ length: N - 1 }, (_, i) => ({
      from: `node-${i}`,
      to: `node-${i + 1}`,
    }));
    expect(() => svc.detect(edges)).not.toThrow();
    expect(svc.detect(edges)).toHaveLength(0);
  });

  it('detects multiple independent cycles', () => {
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' }, // cycle 1
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'X' }, // cycle 2
    ];
    expect(svc.detect(edges)).toHaveLength(2);
  });

  it('does not flag self-loops as cycles', () => {
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'A' }, // self-loop
    ];
    // A self-loop is component of length 1, which the filter excludes
    const cycles = svc.detect(edges);
    cycles.forEach((c) => expect(c.nodes.length).toBeGreaterThan(1));
  });

  it('handles a graph with 20 000 nodes in a linear chain without stack overflow', () => {
    const N = 20_000;
    const edges = Array.from({ length: N - 1 }, (_, i) => ({
      from: `n${i}`,
      to: `n${i + 1}`,
    }));
    const start = performance.now();
    const cycles = svc.detect(edges);
    const elapsed = performance.now() - start;
    expect(cycles).toHaveLength(0);
    expect(elapsed).toBeLessThan(5_000); // Should complete in under 5 seconds
  });
});
