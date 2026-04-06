import Parser from 'tree-sitter';
import { SemanticResult } from './semantic.types';

export class TreeSitterSemanticService {
  analyze(tree: Parser.Tree): SemanticResult {
    const result: SemanticResult = {
      classes: [],
      functions: [],
      imports: [],
    };

    const visit = (node: Parser.SyntaxNode) => {
      const type = node.type;

      // Detect classes
      if (type.includes('class')) {
        const nameNode = node.childForFieldName('name');

        if (nameNode) {
          result.classes.push({
            name: nameNode.text,
          });
        }
      }

      // Detect functions
      if (type.includes('function')) {
        const nameNode = node.childForFieldName('name');

        if (nameNode) {
          result.functions.push({
            name: nameNode.text,
          });
        }
      }

      // Detect imports
      if (type.includes('import')) {
        result.imports.push({
          path: node.text,
        });
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(tree.rootNode);

    return result;
  }
}
