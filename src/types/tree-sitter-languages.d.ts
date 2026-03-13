declare module 'tree-sitter-typescript' {
  const grammar: { typescript: any; tsx: any };
  export = grammar;
}

declare module 'tree-sitter-python'   { const g: any; export = g; }
declare module 'tree-sitter-java'     { const g: any; export = g; }
declare module 'tree-sitter-go'       { const g: any; export = g; }
declare module 'tree-sitter-c-sharp'  { const g: any; export = g; }
declare module 'tree-sitter-ruby'     { const g: any; export = g; }
declare module 'tree-sitter-php'      { const g: { php: any; php_only?: any }; export = g; }
declare module 'tree-sitter-rust'     { const g: any; export = g; }
declare module 'tree-sitter-kotlin'   { const g: any; export = g; }
declare module 'tree-sitter-swift'    { const g: any; export = g; }
declare module 'tree-sitter-scala'    { const g: any; export = g; }
declare module 'tree-sitter-dart'     { const g: any; export = g; }
declare module 'tree-sitter-elixir'   { const g: any; export = g; }