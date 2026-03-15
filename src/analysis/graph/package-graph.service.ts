import { Injectable } from '@nestjs/common';

import { DependencyGraph } from '../../graph/unified-graph.types';

export interface PackageEdge {
  from: string;
  to:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Path-segment classification sets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build/layout boilerplate directories that are never architectural packages.
 *
 * Java/Maven:  src/main/java/...      → skip "main" and "java"
 * Kotlin:      src/main/kotlin/...    → skip "main" and "kotlin"
 * Gradle test: src/test/java/...      → skip "test" and "java"
 */
const SKIP_SEGMENTS = new Set([
  'main', 'test', 'tests', 'it', 'integrationTest', 'integrationTests',
  'java', 'kotlin', 'scala', 'groovy', 'clojure',
  'resources', 'webapp', 'web-app',
  'python', 'lib', 'libs', 'library',
  'app', 'src', 'source', 'sources',
]);

/**
 * Reversed-domain components — never architectural.
 * e.g. com / org / io / example in  com.example.service
 */
const DOMAIN_SEGMENTS = new Set([
  'com', 'org', 'io', 'net', 'edu', 'gov', 'co', 'me', 'dev',
  'github', 'gitlab', 'bitbucket',
  'google', 'microsoft', 'amazon', 'apache', 'eclipse',
  'spring', 'springframework', 'springboot',
]);

/**
 * Known Go/Rust/Clean-Architecture top-level namespace directories.
 * When a path starts with one of these (no src/), the *next* segment
 * is the package name.
 */
const TOPLEVEL_NAMESPACE_DIRS = new Set([
  'internal', 'pkg', 'cmd', 'api', 'handler', 'handlers',
  'service', 'services', 'repository', 'repositories',
  'controller', 'controllers', 'domain', 'usecase', 'usecases',
  'infrastructure', 'adapter', 'adapters', 'module', 'modules',
]);

/**
 * File extensions that use Java-style reversed-domain package paths.
 *
 * For these we want the LAST meaningful directory before the file
 * (i.e. the deepest package, closest to the class).
 *
 * For all other languages (TS, Python, PHP, Ruby…) we want the
 * FIRST meaningful directory after src/ (the top-level module).
 */
const JAVA_STYLE_EXTS = new Set([
  '.java', '.kt', '.kts', '.scala', '.groovy', '.clj',
]);

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PackageGraphService {

  build(graph: DependencyGraph): PackageEdge[] {
    const edges: PackageEdge[] = [];
    const seen  = new Set<string>();

    for (const edge of graph.edges) {
      const fromPkg = this.extractTopLevelPackage(edge.from);
      const toPkg   = this.extractTopLevelPackage(edge.to);

      // Files that live directly at root/src level with no sub-package
      if (!fromPkg || !toPkg) continue;

      // Intra-package imports carry no architectural signal
      if (fromPkg === toPkg) continue;

      const key = `${fromPkg}->${toPkg}`;
      if (seen.has(key)) continue;

      seen.add(key);
      edges.push({ from: fromPkg, to: toPkg });
    }

    return edges;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  /**
   * Returns the best single-token package name for a file path.
   *
   * Strategy by language:
   *
   *   TypeScript/NestJS  src/core/pipeline/foo.ts
   *     → FIRST dir after src/ → "core"
   *
   *   Java/Spring        src/main/java/com/example/service/Foo.java
   *     → skip main, java, com, example → LAST dir before file → "service"
   *
   *   Kotlin/Ktor        src/main/kotlin/io/example/routes/UserRoute.kt
   *     → skip main, kotlin, io, example → LAST dir → "routes"
   *
   *   Python             src/users/views.py
   *     → FIRST dir after src/ → "users"
   *
   *   Go (no src/)       internal/service/user.go
   *     → namespace dir detected → "service"
   */
  private extractTopLevelPackage(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/');
    const parts      = normalized.split('/').filter(p => p.length > 0);

    // Detect file extension
    const fileName = parts[parts.length - 1] ?? '';
    const dotIdx   = fileName.lastIndexOf('.');
    const ext      = dotIdx >= 0 ? fileName.slice(dotIdx).toLowerCase() : '';
    const isJavaLike = JAVA_STYLE_EXTS.has(ext);

    const srcIndex = parts.indexOf('src');

    if (srcIndex !== -1) {
      if (isJavaLike) {
        // Java-style: architectural package = last dir before the file
        return this.lastMeaningfulDir(parts, srcIndex + 1, parts.length - 1);
      }
      // TS/Python/PHP/Ruby: architectural package = first dir after src/
      return this.firstMeaningfulDir(parts, srcIndex + 1, parts.length - 1);
    }

    // No src/ — Go / Rust / flat layouts
    // Look for a known namespace directory; the segment after it is the package
    for (let i = 0; i < parts.length - 1; i++) {
      if (TOPLEVEL_NAMESPACE_DIRS.has(parts[i])) {
        const next = parts[i + 1];
        if (next && !next.includes('.')) return next;
      }
    }

    // Last resort: scan from start
    return this.firstMeaningfulDir(parts, 0, parts.length - 1);
  }

  /**
   * Returns the first non-boilerplate, non-domain directory in parts[start..end).
   * Used for TypeScript, Python, PHP, Ruby — where the top-level module
   * folder immediately under src/ is the architectural unit.
   */
  private firstMeaningfulDir(parts: string[], start: number, end: number): string | null {
    for (let i = start; i < end; i++) {
      const seg = parts[i];
      if (seg.includes('.'))                       return null; // hit a filename
      if (SKIP_SEGMENTS.has(seg))                  continue;
      if (DOMAIN_SEGMENTS.has(seg.toLowerCase()))  continue;
      return seg;
    }
    return null;
  }

  /**
   * Returns the LAST non-boilerplate, non-domain directory in parts[start..end).
   * Used for Java/Kotlin/Scala — where the reversed-domain path means the
   * architectural package is the deepest directory before the class file.
   *
   * e.g. [main, java, com, example, service, UserService.java]
   *      iterating backwards: file → skip "UserService.java" (contains dot)
   *      "service" → not boilerplate, not domain → return "service" ✓
   */
  private lastMeaningfulDir(parts: string[], start: number, end: number): string | null {
    for (let i = end - 1; i >= start; i--) {
      const seg = parts[i];
      if (seg.includes('.'))                       continue; // file name
      if (SKIP_SEGMENTS.has(seg))                  continue;
      if (DOMAIN_SEGMENTS.has(seg.toLowerCase()))  continue;
      return seg;
    }
    return null;
  }
}