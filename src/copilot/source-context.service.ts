import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import { GithubScannerService } from '../input/github/github-scanner.service';
import { DEFAULT_IGNORED_FOLDERS } from '../shared/constants/ignore-folders';
import { SourceTreeEntry } from './source-tree.types';

export interface SourcePackRequest {
  /** Repo-relative paths (files or directories). Examples: "src/auth", "src/auth/auth.module.ts" */
  paths: string[];
  /** If true, include files imported by the selected files (best-effort, TS/JS only). */
  includeImportClosure?: boolean;
  /** Max recursion depth for import closure. */
  importDepth?: number;
  /** Hard cap on total bytes returned across all file contents. */
  maxTotalBytes?: number;
  /** Per-file cap; content is truncated if larger. */
  maxFileBytes?: number;
  /** Hard cap on number of files returned. */
  maxFiles?: number;
}

export interface SourcePackFile {
  path: string;
  bytes: number;
  tokens: number;
  truncated: boolean;
  content: string;
}

export interface SourcePackResponse {
  rootHint: string;
  totalBytes: number;
  totalTokens: number;
  files: SourcePackFile[];
}

export interface SourceTreeResponse {
  rootHint: string;
  entries: SourceTreeEntry[];
}

function normalizeRepoRelative(p: string): string {
  const cleaned = p.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  // Disallow traversal
  if (cleaned.includes('..')) return '';
  return cleaned;
}

function estimateTokensFromBytes(bytes: number): number {
  // Rough heuristic: ~4 chars/token, assume 1 byte ~= 1 char for typical source.
  return Math.ceil(bytes / 4);
}

function isProbablyTextFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  // Allow common code/config/docs
  return (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.json') ||
    lower.endsWith('.md') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.env') ||
    lower.endsWith('.prisma') ||
    lower.endsWith('.sql') ||
    lower.endsWith('.txt')
  );
}

@Injectable()
export class SourceContextService {
  constructor(
    private readonly cache: AnalysisCacheService,
    private readonly githubScanner: GithubScannerService,
  ) {}

  async buildSourceTree(jobId: string, maxEntries = 5000): Promise<SourceTreeResponse> {
    const meta = await this.cache.getMeta(jobId);
    if (!meta) throw new NotFoundException(`Job ${jobId} not found`);
    const cappedMaxEntries = Math.max(100, Math.min(maxEntries, 20_000));

    const cachedTree = await this.cache.getSourceTree(jobId);
    if (cachedTree && cachedTree.length > 0) {
      const rootHint = meta.isGitHub
        ? `${meta.source}${meta.branch ? `@${meta.branch}` : ''}${meta.subdir ? `:${meta.subdir}` : ''}`
        : meta.source;
      return {
        rootHint,
        entries: cachedTree.slice(0, cappedMaxEntries),
      };
    }

    let rootPath: string | null = null;
    let cleanup: (() => Promise<void>) | null = null;

    if (meta.isGitHub) {
      const clonedPath = await this.githubScanner.clone(meta.source, {
        branch: meta.branch,
        subdir: undefined,
      });
      const fullRoot = meta.subdir ? path.join(clonedPath, meta.subdir) : clonedPath;
      if (!(await fsExtra.pathExists(fullRoot))) {
        await this.githubScanner.safeRemove(clonedPath);
        throw new NotFoundException(`Subdirectory "${meta.subdir}" not found in repo`);
      }
      rootPath = fullRoot;
      cleanup = async () => {
        await this.githubScanner.safeRemove(clonedPath);
      };
    } else {
      rootPath = meta.source;
    }

    const rootHint = meta.isGitHub
      ? `${meta.source}${meta.branch ? `@${meta.branch}` : ''}${meta.subdir ? `:${meta.subdir}` : ''}`
      : meta.source;

    try {
      const fileSet = new Set<string>();
      await this.collectFiles(rootPath, rootPath, fileSet, cappedMaxEntries);
      const files = Array.from(fileSet)
        .filter((p) => isProbablyTextFile(p))
        .slice(0, cappedMaxEntries);

      const dirs = new Set<string>();
      for (const f of files) {
        const parts = f.replace(/\\/g, '/').split('/').filter(Boolean);
        for (let i = 1; i < parts.length; i += 1) {
          dirs.add(parts.slice(0, i).join('/'));
        }
      }

      const dirEntries: SourceTreeEntry[] = Array.from(dirs)
        .sort((a, b) => {
          const aDepth = a.split('/').length;
          const bDepth = b.split('/').length;
          if (aDepth !== bDepth) return aDepth - bDepth;
          return a.localeCompare(b);
        })
        .map((d) => ({ path: d, type: 'dir' as const }));

      const fileEntries: SourceTreeEntry[] = files
        .map((f) => f.replace(/\\/g, '/'))
        .sort((a, b) => a.localeCompare(b))
        .map((f) => ({ path: f, type: 'file' as const }));

      const remaining = Math.max(0, cappedMaxEntries - dirEntries.length);
      return {
        rootHint,
        entries: [...dirEntries, ...fileEntries.slice(0, remaining)],
      };
    } finally {
      if (cleanup) await cleanup();
    }
  }

  async buildSourcePack(jobId: string, req: SourcePackRequest): Promise<SourcePackResponse> {
    const meta = await this.cache.getMeta(jobId);
    if (!meta) throw new NotFoundException(`Job ${jobId} not found`);

    const maxTotalBytes = Math.max(10_000, Math.min(req.maxTotalBytes ?? 220_000, 2_000_000));
    const maxFileBytes = Math.max(2_000, Math.min(req.maxFileBytes ?? 45_000, 500_000));
    const maxFiles = Math.max(5, Math.min(req.maxFiles ?? 60, 500));
    const includeImportClosure = Boolean(req.includeImportClosure);
    const importDepth = Math.max(0, Math.min(req.importDepth ?? 2, 6));

    const rawPaths = Array.isArray(req.paths) ? req.paths : [];
    const selected = rawPaths
      .map(normalizeRepoRelative)
      .filter((p) => p.length > 0);

    if (selected.length === 0) {
      return { rootHint: meta.source, totalBytes: 0, totalTokens: 0, files: [] };
    }

    // Resolve to a readable root (local path or ephemeral clone)
    let rootPath: string | null = null;
    let cleanup: (() => Promise<void>) | null = null;

    if (meta.isGitHub) {
      // Clone full repo, then apply subdir as root if requested.
      const clonedPath = await this.githubScanner.clone(meta.source, {
        branch: meta.branch,
        subdir: undefined,
      });
      const fullRoot = meta.subdir
        ? path.join(clonedPath, meta.subdir)
        : clonedPath;

      if (!(await fsExtra.pathExists(fullRoot))) {
        await this.githubScanner.safeRemove(clonedPath);
        throw new NotFoundException(`Subdirectory "${meta.subdir}" not found in repo`);
      }

      rootPath = fullRoot;
      cleanup = async () => {
        await this.githubScanner.safeRemove(clonedPath);
      };
    } else {
      rootPath = meta.source;
    }

    const rootHint = meta.isGitHub
      ? `${meta.source}${meta.branch ? `@${meta.branch}` : ''}${meta.subdir ? `:${meta.subdir}` : ''}`
      : meta.source;

    try {
      const fileSet = new Set<string>();
      for (const p of selected) {
        const abs = path.join(rootPath, p);
        // Ensure within rootPath
        const rel = path.relative(rootPath, abs);
        if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
        await this.collectFiles(abs, rootPath, fileSet, maxFiles);
        if (fileSet.size >= maxFiles) break;
      }

      let files = Array.from(fileSet)
        .filter((p) => isProbablyTextFile(p))
        .slice(0, maxFiles);

      if (includeImportClosure && importDepth > 0) {
        files = await this.expandImportClosure(rootPath, files, maxFiles, importDepth);
      }

      const out: SourcePackFile[] = [];
      let totalBytes = 0;

      for (const relPath of files) {
        if (out.length >= maxFiles) break;
        if (totalBytes >= maxTotalBytes) break;

        const abs = path.join(rootPath, relPath);
        const stat = await fs.stat(abs).catch(() => null);
        if (!stat || !stat.isFile()) continue;
        if (stat.size === 0) continue;

        const remaining = Math.max(0, maxTotalBytes - totalBytes);
        const cap = Math.min(maxFileBytes, remaining);
        if (cap <= 0) break;

        const contentBuf = await fs.readFile(abs);
        const sliced = contentBuf.subarray(0, cap);
        const truncated = contentBuf.length > cap;
        const content = sliced.toString('utf8');
        const bytes = Buffer.byteLength(content, 'utf8');
        const tokens = estimateTokensFromBytes(bytes);

        out.push({ path: relPath.replace(/\\/g, '/'), bytes, tokens, truncated, content });
        totalBytes += bytes;
      }

      const totalTokens = out.reduce((sum, f) => sum + f.tokens, 0);
      return { rootHint, totalBytes, totalTokens, files: out };
    } finally {
      if (cleanup) await cleanup();
    }
  }

  private async collectFiles(
    absPath: string,
    rootPath: string,
    out: Set<string>,
    maxFiles: number,
  ): Promise<void> {
    if (out.size >= maxFiles) return;

    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat) return;

    if (stat.isFile()) {
      const rel = path.relative(rootPath, absPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return;
      out.add(rel);
      return;
    }

    if (!stat.isDirectory()) return;

    const entries = await fs.readdir(absPath, { withFileTypes: true });
    for (const e of entries) {
      if (out.size >= maxFiles) return;
      if (DEFAULT_IGNORED_FOLDERS.includes(e.name)) continue;
      const childAbs = path.join(absPath, e.name);
      if (e.isDirectory()) await this.collectFiles(childAbs, rootPath, out, maxFiles);
      else if (e.isFile()) {
        const rel = path.relative(rootPath, childAbs);
        if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
        out.add(rel);
      }
    }
  }

  private async expandImportClosure(
    rootPath: string,
    initialFiles: string[],
    maxFiles: number,
    depth: number,
  ): Promise<string[]> {
    const queue: Array<{ file: string; depth: number }> = initialFiles.map((f) => ({ file: f, depth: 0 }));
    const seen = new Set<string>(initialFiles);

    while (queue.length > 0 && seen.size < maxFiles) {
      const cur = queue.shift()!;
      if (cur.depth >= depth) continue;
      const lower = cur.file.toLowerCase();
      if (!(lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.js') || lower.endsWith('.jsx'))) {
        continue;
      }

      const abs = path.join(rootPath, cur.file);
      const content = await fs.readFile(abs, 'utf8').catch(() => '');
      if (!content) continue;

      const imports = this.extractImports(content);
      for (const spec of imports) {
        if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
        const resolved = this.resolveImport(rootPath, cur.file, spec);
        if (!resolved) continue;
        if (!seen.has(resolved) && seen.size < maxFiles) {
          seen.add(resolved);
          queue.push({ file: resolved, depth: cur.depth + 1 });
        }
      }
    }

    return Array.from(seen);
  }

  private extractImports(content: string): string[] {
    const out: string[] = [];
    const re = /\bimport\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/g;
    const re2 = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) out.push(m[1]);
    while ((m = re2.exec(content))) out.push(m[1]);
    return out;
  }

  private resolveImport(rootPath: string, fromRelFile: string, spec: string): string | null {
    const fromDir = path.dirname(path.join(rootPath, fromRelFile));
    const absBase = spec.startsWith('/')
      ? path.join(rootPath, spec)
      : path.resolve(fromDir, spec);

    const candidates = [
      absBase,
      `${absBase}.ts`,
      `${absBase}.tsx`,
      `${absBase}.js`,
      `${absBase}.jsx`,
      path.join(absBase, 'index.ts'),
      path.join(absBase, 'index.tsx'),
      path.join(absBase, 'index.js'),
      path.join(absBase, 'index.jsx'),
    ];

    for (const abs of candidates) {
      const rel = path.relative(rootPath, abs);
      if (rel.startsWith('..') || path.isAbsolute(rel)) continue;
      // eslint-disable-next-line no-await-in-loop
      if (fsExtra.existsSync(abs) && fsExtra.statSync(abs).isFile()) {
        return rel;
      }
    }
    return null;
  }
}

