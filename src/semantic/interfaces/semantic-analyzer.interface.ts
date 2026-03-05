export interface SemanticNode {
  id: string;
  type: string;
}

export interface SemanticEdge {
  from: string;
  to: string;
  type: string;
}

export interface SemanticResult {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
}

export interface SemanticAnalyzer {
  supports(language: string): boolean;

  analyze(projectPath: string): SemanticResult;
}