import { Injectable } from '@nestjs/common';
import { InternalServerErrorException } from '@nestjs/common';
import * as path   from 'path';
import * as fs     from 'fs-extra';
import * as fsNative from 'fs/promises';
import simpleGit   from 'simple-git';
import { randomUUID } from 'crypto';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { APP_CONSTANTS } from '../../common/constants/app.constants';

/**
 * WHY the changes here:
 *
 * 1. TIMEOUT: simpleGit has no default timeout. A stalled TCP connection
 *    to github.com hangs the analysis request forever. We wrap the clone
 *    in a Promise.race against a timer.
 *
 * 2. PREDICTABLE TEMP PATH: Date.now() alone is predictable and creates
 *    a race window. We use randomUUID() instead.
 *
 * 3. FILE COUNT GUARD: After clone, we count files. A 50 000-file monorepo
 *    will consume gigabytes of memory during analysis. We abort early with
 *    a clear error rather than OOM-crashing the process.
 *
 * 4. SHALLOW CLONE: --depth 1 is already there (good), but we also add
 *    --single-branch and a filter to skip blobs we don't need to parse.
 */
@Injectable()
export class GithubScannerService {
  constructor(private readonly logger: AppLoggerService) {}

  async clone(repoUrl: string): Promise<string> {
    const tempDir = path.join(
      process.cwd(),
      '.tmp',
      `repo-${randomUUID()}`,
    );

    await fs.ensureDir(tempDir);

    this.logger.log(`Cloning ${repoUrl} into ${tempDir}`, 'GithubScannerService');

    const clonePromise = simpleGit().clone(repoUrl, tempDir, [
      '--depth',         '1',
      '--single-branch',
      '--no-tags',
    ]);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Clone timed out after ${APP_CONSTANTS.CLONE_TIMEOUT_MS / 1000}s`)),
        APP_CONSTANTS.CLONE_TIMEOUT_MS,
      ),
    );

    try {
      await Promise.race([clonePromise, timeoutPromise]);
    } catch (err) {
      // Always clean up the temp dir on failure
      await this.safeRemove(tempDir);
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Clone failed',
      );
    }

    // Guard against enormous repos that would exhaust memory during analysis
    const fileCount = await this.countFiles(tempDir);
    if (fileCount > APP_CONSTANTS.MAX_REPO_FILES) {
      await this.safeRemove(tempDir);
      throw new InternalServerErrorException(
        `Repository has ${fileCount} files which exceeds the limit of ${APP_CONSTANTS.MAX_REPO_FILES}`,
      );
    }

    this.logger.log(
      `Clone complete: ${fileCount} files in ${tempDir}`,
      'GithubScannerService',
    );

    return tempDir;
  }

  async safeRemove(dirPath: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      await fsNative.rm(dirPath, {
        recursive:  true,
        force:      true,
        maxRetries: 5,
        retryDelay: 300,
      });
    } catch (err) {
      this.logger.warn(
        `Could not remove temp dir "${dirPath}": ${String(err)}. Delete manually.`,
        'GithubScannerService',
      );
    }
  }

  private async countFiles(dirPath: string): Promise<number> {
    let count = 0;
    const IGNORED = new Set([
      'node_modules', '.git', 'dist', 'build', 'target', 'vendor',
    ]);
    const walk = async (dir: string): Promise<void> => {
      const entries = await fsNative.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue;
        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name));
        } else {
          count++;
          // Early exit once we've exceeded the limit
          if (count > APP_CONSTANTS.MAX_REPO_FILES) return;
        }
      }
    };
    await walk(dirPath);
    return count;
  }
}