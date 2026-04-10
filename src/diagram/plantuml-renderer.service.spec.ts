import { PlantUmlRendererService } from './plantuml-renderer.service';
import { validatePlantUML } from './plantuml-builder';

describe('PlantUmlRendererService', () => {
  let svc: PlantUmlRendererService;
  beforeEach(() => {
    svc = new PlantUmlRendererService();
  });

  describe('renderClassDiagram', () => {
    it('returns empty diagram when no nodes', () => {
      const result = svc.renderClassDiagram({ nodes: [], edges: [] });
      expect(result).toContain('No class data available');
    });

    it('emits @startuml and @enduml', () => {
      const result = svc.renderClassDiagram({
        nodes: [
          { id: 'UserController', type: 'controller', source: 'semantic' },
        ],
        edges: [],
      });
      expect(result).toContain('@startuml');
      expect(result).toContain('@enduml');
    });

    it('adds <<Controller>> stereotype for controller nodes', () => {
      const result = svc.renderClassDiagram({
        nodes: [
          { id: 'UserController', type: 'controller', source: 'semantic' },
        ],
        edges: [],
      });
      expect(result).toContain('<<Controller>>');
    });

    it('groups nodes into packages using directory or clustering', () => {
      const result = svc.renderClassDiagram({
        nodes: [
          { id: 'UserController', type: 'controller', source: 'semantic', filePath: 'src/users/user.controller.ts' },
          { id: 'UserService', type: 'service', source: 'semantic', filePath: 'src/users/user.service.ts' },
        ],
        edges: [],
      });
      // Directory-based grouping: both in src/users/
      expect(result).toContain('package "users"');
    });

    it('deduplicates edges', () => {
      const result = svc.renderClassDiagram({
        nodes: [
          { id: 'A', type: 'service', source: 'semantic' },
          { id: 'B', type: 'controller', source: 'semantic' },
        ],
        edges: [
          { from: 'A', to: 'B', type: 'constructor-injection' },
          { from: 'A', to: 'B', type: 'constructor-injection' },
        ],
      });
      const matches = result.match(/A \.\.> B/g) ?? [];
      expect(matches).toHaveLength(1);
    });

    it('produces valid PlantUML', () => {
      const result = svc.renderClassDiagram({
        nodes: [
          { id: 'Ctrl', type: 'controller', source: 'semantic' },
          { id: 'Svc', type: 'service', source: 'semantic' },
        ],
        edges: [
          { from: 'Ctrl', to: 'Svc', type: 'constructor-injection' },
        ],
      });
      const validation = validatePlantUML(result);
      expect(validation.valid).toBe(true);
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

    it('produces valid PlantUML', () => {
      const nodes = Array.from({ length: 3 }, (_, i) => ({
        id: `Module${i}`,
        type: 'module' as const,
        source: 'semantic' as const,
      }));
      const result = svc.renderComponentDiagram({ nodes, edges: [] });
      const validation = validatePlantUML(result);
      expect(validation.valid).toBe(true);
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

    it('uses boundary for controller nodes', () => {
      const result = svc.renderSequenceDiagram({
        nodes: [
          { id: 'UserController', type: 'controller', source: 'semantic' },
        ],
        edges: [],
      });
      expect(result).toContain('boundary');
    });

    it('emits balanced activate/deactivate pairs', () => {
      const result = svc.renderSequenceDiagram({
        nodes: [
          { id: 'A', type: 'controller', source: 'semantic' },
          { id: 'B', type: 'service', source: 'semantic' },
        ],
        edges: [{ from: 'A', to: 'B', type: 'constructor-injection' }],
      });
      const validation = validatePlantUML(result);
      expect(validation.valid).toBe(true);
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

    it('produces valid PlantUML', () => {
      const edges = [{ from: 'X', to: 'Y' }];
      const result = svc.renderDependencyGraph(edges);
      const validation = validatePlantUML(result);
      expect(validation.valid).toBe(true);
    });
  });
});
