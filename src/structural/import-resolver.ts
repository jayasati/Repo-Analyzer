import * as path from 'path';
import * as fs from 'fs-extra';
import type { SupportedLanguage } from './import-extractor';

export function resolveImport(
  currentFile: string,
  importPath: string,
  language: SupportedLanguage = 'unknown',
  projectRoot?: string,
): string | null {
  if (language === 'python') {
    return resolvePythonImport(currentFile, importPath, projectRoot);
  }

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

function resolvePythonImport(
  currentFile: string,
  importPath: string,
  projectRoot?: string,
): string | null {
  const currentDir = path.dirname(currentFile);
  const normalizedImport = importPath.replace(/\//g, '.');
  const root = projectRoot ? path.resolve(projectRoot) : path.parse(currentFile).root;

  // Relative import: ".foo.bar" / "..foo"
  if (normalizedImport.startsWith('.')) {
    let dots = 0;
    while (normalizedImport[dots] === '.') dots++;
    const modulePath = normalizedImport.slice(dots);
    let baseDir = currentDir;
    for (let i = 1; i < dots; i++) {
      baseDir = path.dirname(baseDir);
    }
    return resolvePythonModuleFromBase(baseDir, modulePath);
  }

  // Absolute import: "pkg.sub.module" — try resolving inside repo root first.
  return resolvePythonModuleFromBase(root, normalizedImport);
}

function resolvePythonModuleFromBase(
  baseDir: string,
  modulePath: string,
): string | null {
  const moduleFsPath = modulePath.split('.').join(path.sep);
  const candidates = [
    path.resolve(baseDir, `${moduleFsPath}.py`),
    path.resolve(baseDir, moduleFsPath, '__init__.py'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.normalize(candidate);
    }
  }
  return null;
}
