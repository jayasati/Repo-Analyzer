
// WHY churn matters for risk:
// A module that changes every day AND has high fan-out is a "fragile hub".
// Every commit there ripples through the whole system.
// This service uses `simple-git` (already installed) to pull commit frequency
// per module and exposes it as a normalised churn score [0, 1].

import { Injectable } from '@nestjs/common';
import simpleGit, { LogResult }      from 'simple-git';
import * as path      from 'path';

export interface ChurnEntry {
  module:   string;
  commits:  number;
  /** Normalised [0, 1] relative to the most-changed module */
  churnScore: number;
}

@Injectable()
export class GitChurnService {

  /**
   * Returns per-module churn scores for a local repo path.
   *
   * @param repoPath  Absolute path to the repo root.
   * @param sinceWeeks  How many weeks of history to scan (default: 12).
   * @param topLevelSrcDir  The "src" directory prefix used by PackageGraphService.
   */
  async computeChurn(
    repoPath:        string,
    sinceWeeks       = 12,
    topLevelSrcDir   = 'src',
  ): Promise<ChurnEntry[]> {
    const git   = simpleGit(repoPath);
    const since = new Date();
    since.setDate(since.getDate() - sinceWeeks * 7);

    let log: LogResult<{ hash: string }>;
    try {
      log = await git.log({
        '--since': since.toISOString().split('T')[0],
        '--name-only': null as any,
        '--format': '%H',
      } as any);
    } catch {
      return []; // not a git repo or git not available
    }

    // Count commits touching each top-level package
    const commitsByModule = new Map<string, Set<string>>();

    for (const entry of log.all) {
      const show = await git.show([
        '--name-only',
        '--format=',
        entry.hash,
      ]).catch(() => '');

      for (const file of show.split('\n').filter(Boolean)) {
        const mod = this.extractModule(file, topLevelSrcDir);
        if (!mod) continue;
        if (!commitsByModule.has(mod)) commitsByModule.set(mod, new Set());
        commitsByModule.get(mod)!.add(entry.hash);
      }
    }

    if (commitsByModule.size === 0) return [];

    const max = Math.max(...Array.from(commitsByModule.values()).map(s => s.size));

    return Array.from(commitsByModule.entries())
      .map(([module, commits]) => ({
        module,
        commits:    commits.size,
        churnScore: Number((commits.size / max).toFixed(3)),
      }))
      .sort((a, b) => b.commits - a.commits);
  }

  private extractModule(filePath: string, srcDir: string): string | null {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const idx   = parts.indexOf(srcDir);
    if (idx === -1 || idx + 1 >= parts.length) return null;
    const candidate = parts[idx + 1];
    // Skip files at the src root level (e.g. src/main.ts)
    if (candidate.includes('.')) return null;
    return candidate;
  }
}