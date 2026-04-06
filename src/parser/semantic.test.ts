import { TreeSitterParserService } from './tree-sitter-parser.service';
import { TreeSitterSemanticService } from './tree-sitter-semantic.service';

const parser = new TreeSitterParserService();
const semantic = new TreeSitterSemanticService();

parser.setLanguage('typescript');

const code = `
import { UserService } from "./user.service";

class UserController {

  constructor(private service: UserService) {}

  getUsers() {}

}

function helper() {}
`;

const tree = parser.parse(code);

const result = semantic.analyze(tree);

console.log(JSON.stringify(result, null, 2));
