import { DiagramGraph } from './diagram-prep.service';

export class PlantUmlRendererService {
  renderClassDiagram(graph: DiagramGraph): string {
    const lines: string[] = ['@startuml'];

    graph.nodes.forEach(n => {
      lines.push(`class ${n.id}`);
    });

    graph.edges.forEach(e => {
      lines.push(`${e.from} --> ${e.to}`);
    });

    lines.push('@enduml');
    return lines.join('\n');
  }

  renderComponentDiagram(graph: DiagramGraph): string {
    const lines: string[] = ['@startuml'];

    graph.nodes.forEach(n => {
      lines.push(`component ${n.id}`);
    });

    graph.edges.forEach(e => {
      lines.push(`${e.from} --> ${e.to}`);
    });

    lines.push('@enduml');
    return lines.join('\n');
  }

  renderSequenceDiagram(graph: DiagramGraph): string {
    const lines: string[] = ['@startuml'];

    graph.nodes.forEach(n => {
      lines.push(`participant ${n.id}`);
    });

    graph.edges.forEach(e => {
      lines.push(`${e.from} -> ${e.to}`);
    });

    lines.push('@enduml');
    return lines.join('\n');
  }
}
