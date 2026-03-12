/// <reference path="../types/tree-sitter-languages.d.ts" />

import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Java from "tree-sitter-java";
import Go from "tree-sitter-go";

import { LanguageRegistry } from "./language-registry.service";

export function registerLanguages(registry: LanguageRegistry) {

  registry.register("typescript", TypeScript.typescript);
  registry.register("javascript", TypeScript.typescript);

  registry.register("python", Python);

  registry.register("java", Java);

  registry.register("go", Go);

}