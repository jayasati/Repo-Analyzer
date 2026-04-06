export interface ASTClass {
  name: string;
}

export interface ASTFunction {
  name: string;
}

export interface ASTImport {
  path: string;
}

export interface ASTResult {
  classes: ASTClass[];

  functions: ASTFunction[];

  imports: ASTImport[];
}
