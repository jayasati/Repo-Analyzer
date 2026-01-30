export function extractImports(content: string): string[] {
  const imports: string[] = [];

  const patterns = [
    // ES / TS imports (default, named, type, multiline-safe)
    /import\s+(?:type\s+)?[^'"]*?['"]([^'"]+)['"]/g,

    // Side-effect imports: import './setup';
    /import\s+['"]([^'"]+)['"]/g,

    // CommonJS
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,

    // Python
    /from\s+([a-zA-Z0-9_.]+)\s+import\s+/g,

    // C/C++
    /#include\s+[<"]([^">]+)[">]/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}


/*
Improvements -->
Each file gets a fresh regex
No shared lastIndex
Works consistently for local + GitHub
*/

/*
This is not perfect, but:
Fast
Deterministic
Works across languages
*/