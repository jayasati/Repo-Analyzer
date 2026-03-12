import { TreeSitterParserService } from "./tree-sitter-parser.service";

const parser = new TreeSitterParserService();

parser.setLanguage("typescript");

const tree = parser.parse(`
class UserService {
  constructor(repo) {}
}
`);

console.log(tree.rootNode.toString());