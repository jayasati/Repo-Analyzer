import Parser from 'tree-sitter';
import { ASTResult } from './ast.types';

export class TreeSitterWalkerService {
  walk(tree: Parser.Tree): ASTResult {
    const result: ASTResult = {
      classes: [],
      functions: [],
      imports: [],
    };

    const visit = (node: Parser.SyntaxNode) => {
      const type = node.type;

      // Class detection
      if (type.includes('class')) {
        const nameNode = node.childForFieldName('name');

        if (nameNode) {
          result.classes.push({
            name: nameNode.text,
          });
        }
      }

      // Function detection
      if (type.includes('function')) {
        const nameNode = node.childForFieldName('name');

        if (nameNode) {
          result.functions.push({
            name: nameNode.text,
          });
        }
      }

      // Import detection
      if (type.includes('import')) {
        const text = node.text;

        result.imports.push({
          path: text,
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
