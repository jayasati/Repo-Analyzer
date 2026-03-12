declare module "tree-sitter-go" {
  import { Language } from "tree-sitter";
  const Go: Language;
  export = Go;
}

declare module "tree-sitter-python" {
  import { Language } from "tree-sitter";
  const Python: Language;
  export = Python;
}

declare module "tree-sitter-java" {
  import { Language } from "tree-sitter";
  const Java: Language;
  export = Java;
}

declare module "tree-sitter-typescript" {
  import { Language } from "tree-sitter";
  export const typescript: Language;
  export const tsx: Language;
}