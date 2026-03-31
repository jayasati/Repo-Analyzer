import { PlantUmlRendererService } from './plantuml-renderer.service';

describe('PlantUmlRendererService', () => {
  let svc: PlantUmlRendererService;
  beforeEach(() => { svc = new PlantUmlRendererService(); });

  describe('renderClassDiagram', () => {
    it('returns empty diagram when no nodes', () => {
      const result = svc.renderClassDiagram({ nodes: [], edges: [] });
      expect(result).toContain('No class data available');
    });

    it('emits @startuml and @enduml', () => {
      const result = svc.renderClassDiagram({
        nodes: [{ id: 'UserController', type: 'controller', source: 'semantic' }],
        edges: [],
      });
      expect(result).toContain('@startuml');
      expect(result).toContain('@enduml');
    });

    it('adds <<Controller>> stereotype for controller nodes', () => {
      const result = svc.renderClassDiagram({
        nodes: [{ id: 'UserController', type: 'controller', source: 'semantic' }],
        edges: [],
      });
      expect(result).toContain('<<Controller>>');
    });

    it('sanitizes special characters in identifiers', () => {
      const result = svc.renderClassDiagram({
        nodes: [{ id: 'some/path/Service.ts', type: 'service', source: 'semantic' }],
        edges: [],
      });
      // Should not contain slashes or dots in identifiers
      expect(result).not.toMatch(/class some\/path/);
    });

    it('deduplicates edges', () => {
      const result = svc.renderClassDiagram({
        nodes: [
          { id: 'A', type: 'service',    source: 'semantic' },
          { id: 'B', type: 'controller', source: 'semantic' },
        ],
        edges: [
          { from: 'A', to: 'B', type: 'constructor-injection' },
          { from: 'A', to: 'B', type: 'constructor-injection' }, // duplicate
        ],
      });
      const matches = result.match(/A \.\.> B/g) ?? [];
      expect(matches).toHaveLength(1);
    });
  });

  describe('renderComponentDiagram', () => {
    it('uses [bracket] notation for components', () => {
      const result = svc.renderComponentDiagram({
        nodes: [{ id: 'AuthModule', type: 'module', source: 'semantic' }],
        edges: [],
      });
      expect(result).toContain('[AuthModule]');
    });

    it('wraps in package when more than 8 nodes', () => {
      const nodes = Array.from({ length: 9 }, (_, i) => ({
        id: `Module${i}`, type: 'module' as const, source: 'semantic' as const,
      }));
      const result = svc.renderComponentDiagram({ nodes, edges: [] });
      expect(result).toContain('package');
    });
  });

  describe('renderSequenceDiagram', () => {
    it('includes autonumber', () => {
      const result = svc.renderSequenceDiagram({
        nodes: [{ id: 'Ctrl', type: 'controller', source: 'semantic' }],
        edges: [],
      });
      expect(result).toContain('autonumber');
    });

    it('uses actor for controller nodes', () => {
      const result = svc.renderSequenceDiagram({
        nodes: [{ id: 'UserController', type: 'controller', source: 'semantic' }],
        edges: [],
      });
      expect(result).toContain('actor');
    });

    it('emits activate/deactivate pairs', () => {
      const result = svc.renderSequenceDiagram({
        nodes: [
          { id: 'A', type: 'controller', source: 'semantic' },
          { id: 'B', type: 'service',    source: 'semantic' },
        ],
        edges: [{ from: 'A', to: 'B', type: 'constructor-injection' }],
      });
      expect(result).toContain('activate');
      expect(result).toContain('deactivate');
    });
  });

  describe('renderDependencyGraph', () => {
    it('colour-codes hot modules', () => {
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'A', to: 'C' },
      ];
      const result = svc.renderDependencyGraph(edges, new Set(['A']));
      expect(result).toContain('FFD0D0'); // hot module color
      expect(result).toContain('@startuml');
    });
  });
});