import * as path from "path";
import { resolveImport } from "./import-resolver";

const currentFile = path.resolve(
  "src/api/analyze.controller.ts"
);

const result = resolveImport(
  currentFile,
  "../core/analyzer.service"
);

console.log("Current File:", currentFile);
console.log("Resolved Path:", result);