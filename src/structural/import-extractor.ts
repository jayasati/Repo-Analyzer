const IMPORT_REGEXES = [
  /import\s+.*?from\s+['"](.*)['"]/g,          // JS/TS
  /require\(['"](.*)['"]\)/g,                  // CommonJS
  /#include\s+[<"](.*)[>"]/g,                  // C/C++
  /from\s+([\w\.]+)\s+import/g,                // Python
];

export function extractImports(
  content: string
): string[] {
  const imports: string[] = [];

  for (const regex of IMPORT_REGEXES) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/*
This is not perfect, but:
Fast
Deterministic
Works across languages
*/