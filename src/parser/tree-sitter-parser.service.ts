import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Java from "tree-sitter-java";
import Go from "tree-sitter-go";

export class TreeSitterParserService {

  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  setLanguage(language: string) {

    if (language === "TypeScript" || language === "JavaScript") {
      this.parser.setLanguage(TypeScript.typescript);
      return;
    }

    if (language === "Python") {
      this.parser.setLanguage(Python);
      return;
    }

    if (language === "Java") {
      this.parser.setLanguage(Java);
      return;
    }

    if (language === "Go") {
      this.parser.setLanguage(Go);
      return;
    }

    throw new Error(`Unsupported language: ${language}`);
  }

  parse(code: string) {
    return this.parser.parse(code);
  }

}