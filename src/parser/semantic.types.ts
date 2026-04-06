export interface SemanticClass {
  name: string;
}

export interface SemanticFunction {
  name: string;
}

export interface SemanticImport {
  path: string;
}

export interface SemanticResult {
  classes: SemanticClass[];

  functions: SemanticFunction[];

  imports: SemanticImport[];
}
