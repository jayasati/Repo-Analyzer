import { generateComponentDiagram } from './component-generator';
import { validatePlantUML } from './plantuml-builder';
import { DiagramGraph } from './diagram-prep.service';

describe('component-generator', () => {
  it('returns empty diagram for no nodes', () => {
    const result = generateComponentDiagram({ nodes: [], edges: [] });
    expect(result).toContain('No component data available');
  });

  it('generates valid PlantUML with layer grouping', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'UserController', type: 'controller', source: 'semantic' },
        { id: 'UserService', type: 'service', source: 'semantic' },
        { id: 'UserRepo', type: 'class', source: 'semantic' },
      ],
      edges: [
        { from: 'UserController', to: 'UserService', type: 'import' },
        { from: 'UserService', to: 'UserRepo', type: 'import' },
      ],
    };

    const result = generateComponentDiagram(graph);

    expect(result).toContain('@startuml');
    expect(result).toContain('@enduml');
    expect(result).toContain('title Component Architecture');

    // Layer packages (hybrid classification)
    // UserController → Presentation (controller type)
    // UserService → Business Logic (both in+out edges)
    // UserRepo → Shared (sink-only, no keyword match)
    expect(result).toContain('package "Presentation"');
    expect(result).toContain('package "Business Logic"');
    expect(result).toContain('package "Shared"');

    // Component bracket notation
    expect(result).toContain('[UserController]');
    expect(result).toContain('[UserService]');
    expect(result).toContain('[UserRepo]');

    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  it('generates interfaces for nodes with 2+ incoming edges', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'A', type: 'controller', source: 'semantic' },
        { id: 'B', type: 'controller', source: 'semantic' },
        { id: 'SharedService', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'A', to: 'SharedService', type: 'import' },
        { from: 'B', to: 'SharedService', type: 'import' },
      ],
    };

    const result = generateComponentDiagram(graph, { showInterfaces: true });
    expect(result).toContain('interface "ISharedService"');
  });

  it('detects bidirectional tangles', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'ModuleA', type: 'module', source: 'semantic' },
        { id: 'ModuleB', type: 'module', source: 'semantic' },
      ],
      edges: [
        { from: 'ModuleA', to: 'ModuleB', type: 'import' },
        { from: 'ModuleB', to: 'ModuleA', type: 'import' },
      ],
    };

    const result = generateComponentDiagram(graph);
    expect(result).toContain('tangle');
    expect(result).toContain('..[#red].>');
  });

  it('deduplicates nodes and edges', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'Svc', type: 'service', source: 'semantic' },
        { id: 'Svc', type: 'service', source: 'semantic' },
        { id: 'Other', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'Svc', to: 'Other', type: 'import' },
        { from: 'Svc', to: 'Other', type: 'import' },
      ],
    };

    const result = generateComponentDiagram(graph);
    const componentMatches = result.match(/\[Svc\]/g) ?? [];
    // Svc appears in declaration + edge lines, but should be declared once
    const declMatches = result.match(/\[Svc\] <<Component>>/g) ?? [];
    expect(declMatches).toHaveLength(1);
  });

  it('filters self-loop edges', () => {
    const graph: DiagramGraph = {
      nodes: [{ id: 'X', type: 'module', source: 'semantic' }],
      edges: [{ from: 'X', to: 'X', type: 'import' }],
    };

    const result = generateComponentDiagram(graph);
    expect(result).not.toMatch(/\[X\] --> \[X\]/);
  });

  it('falls back to flat grouping when all nodes are same type', () => {
    const nodes = Array.from({ length: 4 }, (_, i) => ({
      id: `Thing${i}`,
      type: 'class' as const,
      source: 'semantic' as const,
    }));

    const result = generateComponentDiagram({ nodes, edges: [] });
    // Should use "Application" fallback instead of empty layer packages
    expect(result).toContain('package "Application"');
  });
});
