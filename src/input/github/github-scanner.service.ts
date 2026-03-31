import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as path      from 'path';
import * as fs        from 'fs-extra';
import * as fsNative  from 'fs/promises';
import simpleGit      from 'simple-git';
import { randomUUID } from 'crypto';
import { AppLoggerService } from '../../common/logger/app-logger.service';
import { APP_CONSTANTS }    from '../../common/constants/app.constants';

export interface CloneOptions {
  branch?: string;
  subdir?: string;
}

@Injectable()
export class GithubScannerService {
  constructor(private readonly logger: AppLoggerService) {}

  /**
   * Clone a GitHub repository and return the path to scan.
   *
   * If subdir is provided, returns <tempDir>/<subdir> instead of <tempDir>,
   * so the rest of the pipeline only sees that directory.
   */
  async clone(repoUrl: string, options: CloneOptions = {}): Promise<string> {
    const { branch, subdir } = options;
    const tempDir = path.join(process.cwd(), '.tmp', `repo-${randomUUID()}`);
    await fs.ensureDir(tempDir);

    this.logger.log(
      `Cloning ${repoUrl}${branch ? ` @ ${branch}` : ''} into ${tempDir}`,
      'GithubScannerService',
    );

    const cloneArgs = [
      '--depth',         '1',
      '--single-branch',
      '--no-tags',
    ];

    // Add branch flag only if specified — simpleGit uses default branch otherwise
    if (branch) {
      cloneArgs.push('--branch', branch);
    }

    const clonePromise = simpleGit().clone(repoUrl, tempDir, cloneArgs);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Clone timed out after ${APP_CONSTANTS.CLONE_TIMEOUT_MS / 1000}s`)),
        APP_CONSTANTS.CLONE_TIMEOUT_MS,
      ),
    );

    try {
      await Promise.race([clonePromise, timeoutPromise]);
    } catch (err) {
      await this.safeRemove(tempDir);
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Clone failed',
      );
    }

    const fileCount = await this.countFiles(tempDir);
    if (fileCount > APP_CONSTANTS.MAX_REPO_FILES) {
      await this.safeRemove(tempDir);
      throw new InternalServerErrorException(
        `Repository has ${fileCount} files which exceeds the limit of ${APP_CONSTANTS.MAX_REPO_FILES}`,
      );
    }

    this.logger.log(
      `Clone complete: ${fileCount} files`,
      'GithubScannerService',
    );

    // If a subdirectory was requested, validate it exists and return it
    if (subdir) {
      const subdirPath = path.join(tempDir, subdir);
      if (!fs.existsSync(subdirPath)) {
        await this.safeRemove(tempDir);
        throw new InternalServerErrorException(
          `Subdirectory "${subdir}" does not exist in the repository`,
        );
      }
      this.logger.log(`Using subdirectory: ${subdirPath}`, 'GithubScannerService');
      return subdirPath;
    }

    return tempDir;
  }

  async safeRemove(dirPath: string): Promise<void> {
    // Walk up to find the .tmp root if we returned a subdir
    const tmpRoot = dirPath.includes('.tmp')
      ? dirPath.slice(0, dirPath.indexOf('.tmp') + dirPath.slice(dirPath.indexOf('.tmp')).indexOf(path.sep, 1))
      : dirPath;

    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      await fsNative.rm(tmpRoot, {
        recursive:  true,
        force:      true,
        maxRetries: 5,
        retryDelay: 300,
      });
    } catch (err) {
      this.logger.warn(
        `Could not remove temp dir "${tmpRoot}": ${String(err)}`,
        'GithubScannerService',
      );
    }
  }

  private async countFiles(dirPath: string): Promise<number> {
    let count = 0;
    const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', 'target', 'vendor']);
    const walk = async (dir: string): Promise<void> => {
      const entries = await fsNative.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name));
        else {
          count++;
          if (count > APP_CONSTANTS.MAX_REPO_FILES) return;
        }
      }
    };
    await walk(dirPath);
    return count;
  }
}