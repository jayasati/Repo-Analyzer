import * as fs from "fs";
import * as path from "path";

import { SemanticAnalyzer } from "../interfaces/semantic-analyzer.interface";
import { SemanticResult } from "../interfaces/semantic-analyzer.interface";

import { TreeSitterParserService } from "../../parser/tree-sitter-parser.service";
import { TreeSitterSemanticService } from "../../parser/tree-sitter-semantic.service";

export class TreeSitterAnalyzer implements SemanticAnalyzer {

  private parser = new TreeSitterParserService();
  private semantic = new TreeSitterSemanticService();

  supports(language: string): boolean {

    const supported = [
      "TypeScript",
      "JavaScript",
      "Python",
      "Java",
      "Go",
    ];

    return supported.includes(language);

  }

//
    analyze(projectPath: string): SemanticResult {

        

        const nodes: any[] = [];
        const edges: any[] = [];

        const files = this.collectFiles(projectPath);
        
        console.log("Scanning files:", files.length);

        files.forEach(file => {

            const language = this.detectLanguage(file);

            // Skip unsupported files
            if (!language) return;

            const code = fs.readFileSync(file, "utf8");

            // Skip empty files
            if (!code.trim()) return;

            try {

            this.parser.setLanguage(language);

            const tree = this.parser.parse(code);

            const result = this.semantic.analyze(tree);

            result.classes.forEach(c => {
                nodes.push({
                id: c.name,
                type: "class"
                });
            });

            result.functions.forEach(f => {
                nodes.push({
                id: f.name,
                type: "function"
                });
            });

            result.imports.forEach(i => {
                edges.push({
                from: file,
                to: i.path,
                type: "import"
                });
            });

            } catch (err) {

            // Skip files Tree-sitter cannot parse
            return;

            }

        });

        return { nodes, edges };

    }
// 

  private collectFiles(dir: string): string[] {

    const ignored = new Set([
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        ".cache",
        ".tmp"
    ]);

    let results: string[] = [];

    const list = fs.readdirSync(dir);

    list.forEach(file => {

      if (ignored.has(file)) return;
      

      const filePath = path.join(dir, file);

      const stat = fs.statSync(filePath);

      if (stat && stat.isDirectory()) {
        results = results.concat(this.collectFiles(filePath));
      }
      else {
        results.push(filePath);
      }

    });

    return results;

  }


    private detectLanguage(file: string): string | null {

        if (file.endsWith(".ts")) return "typescript";
        if (file.endsWith(".js")) return "javascript";
        if (file.endsWith(".py")) return "python";
        if (file.endsWith(".go")) return "go";
        if (file.endsWith(".java")) return "java";

        return null;

    }

}