import { generateSequenceDiagram } from './sequence-generator';
import { validatePlantUML } from './plantuml-builder';
import { DiagramGraph } from './diagram-prep.service';

describe('sequence-generator', () => {
  // ── Empty graph ─────────────────────────────────────────────────────────────

  it('returns empty diagram for no nodes', () => {
    const result = generateSequenceDiagram({ nodes: [], edges: [] });
    expect(result).toContain('No sequence data available');
    expect(result).toContain('@startuml');
    expect(result).toContain('@enduml');
  });

  // ── Small repo: controller → service ────────────────────────────────────────

  it('generates valid PlantUML for simple controller→service flow', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'UserController', type: 'controller', source: 'semantic' },
        { id: 'UserService', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'UserController', to: 'UserService', type: 'constructor-injection' },
      ],
    };

    const result = generateSequenceDiagram(graph);

    // Structural validity
    expect(result).toContain('@startuml');
    expect(result).toContain('@enduml');
    expect(result).toContain('autonumber');

    // Participants declared
    expect(result).toContain('boundary "UserController" as UserController');
    expect(result).toContain('control "UserService" as UserService');

    // Client actor added
    expect(result).toContain('actor "Client" as Client');

    // Proper activation: callee (UserService) gets activated, not caller
    expect(result).toContain('activate UserService');
    expect(result).toContain('deactivate UserService');

    // Client triggers entry point
    expect(result).toContain('Client -> UserController : request');

    // Full diagram validates
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  // ── Medium repo: controller → service → repository ──────────────────────────

  it('generates valid 3-layer sequence diagram', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'OrderController', type: 'controller', source: 'semantic' },
        { id: 'OrderService', type: 'service', source: 'semantic' },
        { id: 'OrderRepository', type: 'class', source: 'semantic' },
        { id: 'NotificationService', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'OrderController', to: 'OrderService', type: 'constructor-injection' },
        { from: 'OrderService', to: 'OrderRepository', type: 'constructor-injection' },
        { from: 'OrderService', to: 'NotificationService', type: 'constructor-injection' },
      ],
    };

    const result = generateSequenceDiagram(graph);

    // All participants declared
    expect(result).toContain('OrderController');
    expect(result).toContain('OrderService');
    expect(result).toContain('OrderRepository');
    expect(result).toContain('NotificationService');

    // Activation balance is correct
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  // ── Edge case: no controller (starts from first node) ───────────────────────

  it('works when there is no controller node', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'AppService', type: 'service', source: 'semantic' },
        { id: 'DbClient', type: 'class', source: 'semantic' },
      ],
      edges: [
        { from: 'AppService', to: 'DbClient', type: 'constructor-injection' },
      ],
    };

    const result = generateSequenceDiagram(graph);
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
    expect(result).toContain('AppService');
  });

  // ── Edge case: self-loop is filtered ────────────────────────────────────────

  it('filters self-loop edges', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'Svc', type: 'service', source: 'semantic' },
      ],
      edges: [
        { from: 'Svc', to: 'Svc', type: 'constructor-injection' },
      ],
    };

    const result = generateSequenceDiagram(graph);
    // Should not have Svc -> Svc message
    expect(result).not.toMatch(/Svc -> Svc/);
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  // ── Edge case: diamond dependency (A→B, A→C, B→D, C→D) ─────────────────────

  it('handles diamond dependencies without duplicate activations', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'A', type: 'controller', source: 'semantic' },
        { id: 'B', type: 'service', source: 'semantic' },
        { id: 'C', type: 'service', source: 'semantic' },
        { id: 'D', type: 'class', source: 'semantic' },
      ],
      edges: [
        { from: 'A', to: 'B', type: 'constructor-injection' },
        { from: 'A', to: 'C', type: 'constructor-injection' },
        { from: 'B', to: 'D', type: 'constructor-injection' },
        { from: 'C', to: 'D', type: 'constructor-injection' },
      ],
    };

    const result = generateSequenceDiagram(graph);
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });

  // ── Depth limit ─────────────────────────────────────────────────────────────

  it('respects maxDepth option', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'L0', type: 'controller', source: 'semantic' },
        { id: 'L1', type: 'service', source: 'semantic' },
        { id: 'L2', type: 'service', source: 'semantic' },
        { id: 'L3', type: 'class', source: 'semantic' },
      ],
      edges: [
        { from: 'L0', to: 'L1', type: 'constructor-injection' },
        { from: 'L1', to: 'L2', type: 'constructor-injection' },
        { from: 'L2', to: 'L3', type: 'constructor-injection' },
      ],
    };

    const result = generateSequenceDiagram(graph, { maxDepth: 1 });
    // L0→L1 should be shown (depth 0), L1→L2 should be shown (depth 1)
    // L2→L3 should NOT be shown (depth 2 > maxDepth 1)
    expect(result).toContain('L0 -> L1');
    expect(result).toContain('L1 -> L2');
    expect(result).not.toContain('L2 -> L3');
  });

  // ── Single node (no edges) ─────────────────────────────────────────────────

  it('handles single node with no edges', () => {
    const graph: DiagramGraph = {
      nodes: [
        { id: 'Lonely', type: 'service', source: 'semantic' },
      ],
      edges: [],
    };

    const result = generateSequenceDiagram(graph);
    expect(result).toContain('@startuml');
    expect(result).toContain('@enduml');
    expect(result).toContain('Lonely');
    const validation = validatePlantUML(result);
    expect(validation.valid).toBe(true);
  });
});
