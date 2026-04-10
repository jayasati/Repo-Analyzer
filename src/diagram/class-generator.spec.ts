import { generateClassDiagram } from './class-generator';
import { validatePlantUML } from './plantuml-builder';
import { DiagramGraph } from './diagram-prep.service';

describe('class-generator', () => {
  it('returns empty diagram for no nodes', () => {
    const result = generateClassDiagram({ nodes: [], edges: [] });
    expect(result).toContain('No class data available');
  });

  it('generates valid PlantUML with directory-based grouping', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'UserController', type: 'controller', source: 'semantic', filePath: 'src/users/user.controller.ts' },
        { id: 'UserService', type: 'service', source: 'semantic', filePath: 'src/users/user.service.ts' },
        { id: 'OrderController', type: 'controller', source: 'semantic', filePath: 'src/orders/order.controller.ts' },
        { id: 'OrderService', type: 'service', source: 'semantic', filePath: 'src/orders/order.service.ts' },
      ],
      edges: [
        { from: 'UserController', to: 'UserService', type: 'constructor-injection' },
        { from: 'OrderController', to: 'OrderService', type: 'constructor-injection' },
      ],
    };

    const result = generateClassDiagram(graph);

    expect(result).toContain('@startuml');
    expect(result).toContain('@enduml');

    // Grouped by directory
    expect(result).toContain('package "users"');
    expect(result).toContain('package "orders"');

    // Stereotypes
    expect(result).toContain('<<Controller>>');
    expect(result).toContain('<<Service>>');

    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  it('folds cross-cutting services using fan-in/fan-out ratio', () => {
    // AppLoggerService: fanIn=4, fanOut=0 → cross-cutting
    const graph: DiagramGraph = {
      nodes: [
        { id: 'AuthController', type: 'controller', source: 'semantic' },
        { id: 'UserController', type: 'controller', source: 'semantic' },
        { id: 'OrderController', type: 'controller', source: 'semantic' },
        { id: 'HistoryController', type: 'controller', source: 'semantic' },
        { id: 'AuthService', type: 'service', source: 'semantic' },
        { id: 'UserService', type: 'service', source: 'semantic' },
        { id: 'OrderService', type: 'service', source: 'semantic' },
        { id: 'HistoryService', type: 'service', source: 'semantic' },
        { id: 'AppLoggerService', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'AuthController', to: 'AuthService', type: 'constructor-injection' },
        { from: 'UserController', to: 'UserService', type: 'constructor-injection' },
        { from: 'OrderController', to: 'OrderService', type: 'constructor-injection' },
        { from: 'HistoryController', to: 'HistoryService', type: 'constructor-injection' },
        { from: 'AuthController', to: 'AppLoggerService', type: 'constructor-injection' },
        { from: 'UserController', to: 'AppLoggerService', type: 'constructor-injection' },
        { from: 'OrderController', to: 'AppLoggerService', type: 'constructor-injection' },
        { from: 'HistoryController', to: 'AppLoggerService', type: 'constructor-injection' },
      ],
    };

    const result = generateClassDiagram(graph);

    // AppLoggerService: fanIn=4 (above mean+1σ), fanOut=0 → folded
    expect(result).not.toContain('class AppLoggerService');
    expect(result).toContain('Cross-cutting');
    expect(result).toContain('AppLoggerService');

    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  it('does not fold cross-cutting on small graphs', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'A', type: 'controller', source: 'semantic' },
        { id: 'B', type: 'service', source: 'semantic' },
        { id: 'Shared', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'A', to: 'Shared', type: 'constructor-injection' },
        { from: 'B', to: 'Shared', type: 'constructor-injection' },
      ],
    };

    const result = generateClassDiagram(graph);
    expect(result).not.toContain('Cross-cutting');
  });

  it('falls back to edge clustering when no filePaths', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'AuthController', type: 'controller', source: 'semantic' },
        { id: 'AuthService', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'AuthController', to: 'AuthService', type: 'constructor-injection' },
      ],
    };

    const result = generateClassDiagram(graph);
    // Should still produce valid grouped output via edge clustering
    expect(result).toContain('@startuml');
    expect(result).toContain('AuthController');
    expect(result).toContain('AuthService');
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  it('respects maxClasses option', () => {
    const nodes = Array.from({ length: 40 }, (_, i) => ({
      id: `Svc${i}`,
      type: 'service' as const,
      source: 'semantic' as const,
    }));
    const edges = Array.from({ length: 39 }, (_, i) => ({
      from: `Svc${i}`,
      to: `Svc${i + 1}`,
      type: 'constructor-injection' as const,
    }));

    const result = generateClassDiagram({ nodes, edges }, { maxClasses: 10 });
    const classCount = (result.match(/class Svc\d+/g) ?? []).length;
    expect(classCount).toBeLessThanOrEqual(10);
  });

  it('only emits edges between declared nodes', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'AuthController', type: 'controller', source: 'semantic' },
      ],
      edges: [
        { from: 'AuthController', to: 'UndeclaredThing', type: 'constructor-injection' },
      ],
    };

    const result = generateClassDiagram(graph);
    expect(result).not.toContain('UndeclaredThing');
  });

  it('uses flat mode when showPackages is false', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'A', type: 'service', source: 'semantic' },
        { id: 'B', type: 'controller', source: 'semantic' },
      ],
      edges: [],
    };

    const result = generateClassDiagram(graph, { showPackages: false });
    expect(result).not.toMatch(/^package "/m);
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });
});
