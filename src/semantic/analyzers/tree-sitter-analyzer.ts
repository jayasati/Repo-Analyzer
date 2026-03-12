import * as fs from 'fs-extra';
import * as path from 'path';
import { SemanticAnalyzer, SemanticResult } from '../interfaces/semantic-analyzer.interface';
import { TreeSitterParserService } from '../../parser/tree-sitter-parser.service';
import { DEFAULT_IGNORED_FOLDERS } from '../../shared/constants/ignore-folders';

const EXT_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.js': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
};

const SUPPORTED_LANGUAGES = new Set([
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Go',
]);

const PRIMITIVES = new Set([
  'string', 'number', 'boolean', 'any', 'unknown',
  'void', 'never', 'object', 'null', 'undefined',
  'int', 'float', 'double', 'char', 'byte', 'long', 'short',
]);

export class TreeSitterAnalyzer implements SemanticAnalyzer {

  private readonly parser = new TreeSitterParserService();

  supports(language: string): boolean {
    return SUPPORTED_LANGUAGES.has(language);
  }

  analyze(projectPath: string): SemanticResult {
    const nodes: { id: string; type: string }[] = [];
    const edges: { from: string; to: string; type: string }[] = [];

    this.walkDir(projectPath, (filePath) => {
      const ext = path.extname(filePath);
      const language = EXT_TO_LANGUAGE[ext];
      if (!language) return;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) return;

        this.parser.setLanguage(language);
        const tree = this.parser.parse(content);
        this.extractFromTree(tree, nodes, edges);
      } catch {
        // skip unparseable files
      }
    });

    return { nodes, edges };
  }

  private extractFromTree(
    tree: any,
    nodes: { id: string; type: string }[],
    edges: { from: string; to: string; type: string }[],
  ) {
    const visit = (node: any) => {
      if (this.isClassNode(node.type)) {
        const nameNode = node.childForFieldName('name');
        if (nameNode?.text) {
          const className = nameNode.text;

          // Classify NestJS modules by naming convention
          const nodeType = this.resolveNodeType(className);
          nodes.push({ id: className, type: nodeType });

          this.extractConstructorEdges(node, className, edges);
        }
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(tree.rootNode);
  }

  private extractConstructorEdges(
    classNode: any,
    className: string,
    edges: { from: string; to: string; type: string }[],
  ) {
    const visit = (node: any) => {
      const isConstructor =
        (node.type === 'method_definition' &&
          node.childForFieldName('name')?.text === 'constructor') ||
        node.type === 'constructor_declaration';

      if (isConstructor) {
        const params = node.childForFieldName('parameters');
        if (params) {
          for (const param of params.children) {
            const typeName = this.extractParamType(param);
            if (typeName && this.isUserDefinedType(typeName)) {
              edges.push({
                from: className,
                to: typeName,
                type: 'constructor-injection',
              });
            }
          }
        }
        return;
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(classNode);
  }

  private extractParamType(paramNode: any): string | null {
    if (
      paramNode.type === 'required_parameter' ||
      paramNode.type === 'optional_parameter'
    ) {
      const typeAnnotation = paramNode.childForFieldName('type');
      if (typeAnnotation) return this.resolveTypeAnnotation(typeAnnotation);
    }

    if (paramNode.type === 'formal_parameter') {
      const typeNode = paramNode.childForFieldName('type');
      if (typeNode) return typeNode.text.trim();
    }

    return null;
  }

  private resolveTypeAnnotation(node: any): string | null {
    if (node.type === 'type_annotation') {
      const inner = node.children.find(
        (c: any) =>
          c.type === 'type_identifier' ||
          c.type === 'predefined_type' ||
          c.type === 'generic_type',
      );
      if (!inner) return null;
      if (inner.type === 'generic_type') {
        return inner.childForFieldName('name')?.text ?? null;
      }
      return inner.text.trim();
    }

    if (node.type === 'type_identifier') return node.text.trim();

    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Classify a class by name convention:
   * - Ends with 'Module'     → 'module'
   * - Ends with 'Service'    → 'service'
   * - Ends with 'Controller' → 'controller'
   * - Otherwise              → 'class'
   */
  private resolveNodeType(className: string): string {
    if (className.endsWith('Module')) return 'module';
    if (className.endsWith('Service')) return 'service';
    if (className.endsWith('Controller')) return 'controller';
    return 'class';
  }

  private isClassNode(type: string): boolean {
    return (
      type === 'class_declaration' ||
      type === 'class' ||
      type === 'class_definition'
    );
  }

  private isUserDefinedType(name: string): boolean {
    return !PRIMITIVES.has(name.toLowerCase()) && /^[A-Z]/.test(name);
  }

  private walkDir(dirPath: string, callback: (filePath: string) => void) {
    let items: string[];
    try {
      items = fs.readdirSync(dirPath);
    } catch {
      return;
    }

    for (const item of items) {
      if (DEFAULT_IGNORED_FOLDERS.includes(item)) continue;

      const fullPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          this.walkDir(fullPath, callback);
        } else {
          callback(fullPath);
        }
      } catch {
        continue;
      }
    }
  }
}