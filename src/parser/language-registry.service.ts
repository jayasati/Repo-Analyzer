// Tree-sitter grammars don't export proper TS types,
// so we define a compatible grammar type.

export type TreeSitterLanguage = any;

export class LanguageRegistry {
  private languages = new Map<string, TreeSitterLanguage>();

  register(name: string, grammar: TreeSitterLanguage) {
    this.languages.set(name.toLowerCase(), grammar);
  }

  get(name: string): TreeSitterLanguage | undefined {
    return this.languages.get(name.toLowerCase());
  }

  list(): string[] {
    return Array.from(this.languages.keys());
  }
}
