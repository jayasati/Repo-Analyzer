import { TreeSitterParserService } from "./tree-sitter-parser.service";
import { TreeSitterWalkerService } from "./tree-sitter-walker.service";

const parser = new TreeSitterParserService();
const walker = new TreeSitterWalkerService();

parser.setLanguage("TypeScript");

const code = `
import { UserService } from "./user.service";

class UserController {

  constructor(private service: UserService) {}

  getUsers() {}

}

function helper() {}
`;

const tree = parser.parse(code);

const result = walker.walk(tree);

console.log(JSON.stringify(result, null, 2));