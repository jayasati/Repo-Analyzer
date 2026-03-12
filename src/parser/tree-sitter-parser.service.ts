/// <reference path="../types/tree-sitter-languages.d.ts" />

import Parser from "tree-sitter";

import { LanguageRegistry } from "./language-registry.service";
import { registerLanguages } from "./register-languages";

export class TreeSitterParserService {

  private parser: Parser;
  private registry: LanguageRegistry;

  constructor() {

    this.parser = new Parser();

    this.registry = new LanguageRegistry();

    registerLanguages(this.registry);

  }

  setLanguage(language: string) {

    const grammar = this.registry.get(language);

    if (!grammar) {
      throw new Error(`Unsupported language: ${language}`);
    }

    this.parser.setLanguage(grammar);

  }

  parse(code: string) {
    return this.parser.parse(code);
  }

}