import * as path from 'path';
import * as fs from 'fs-extra';

export function resolveImport(
  currentFile: string,
  importPath: string,
): string | null {

  // Ignore external libraries
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const baseDir = path.dirname(currentFile);

  const possiblePaths = [
    path.resolve(baseDir, importPath),
    path.resolve(baseDir, importPath + '.ts'),
    path.resolve(baseDir, importPath + '.js'),
    path.resolve(baseDir, importPath, 'index.ts'),
    path.resolve(baseDir, importPath, 'index.js'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return path.normalize(p);
    }
  }

  return null;
}