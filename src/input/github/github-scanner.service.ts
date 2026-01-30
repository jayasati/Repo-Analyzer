import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
import simpleGit from 'simple-git';
import { LocalScannerService } from '../local/local-scanner.service';
import { FileNode } from '../../core/types/file-node.type';

@Injectable()
export class GithubScannerService {
  private readonly git = simpleGit();

  constructor(
    private readonly localScanner: LocalScannerService,
  ) {}

  async scan(repoUrl: string): Promise<FileNode> {
    const tempDir = path.join(
      process.cwd(),
      '.tmp',
      `repo-${Date.now()}`
    );

    try {
      await fs.ensureDir(tempDir);

      await this.git.clone(repoUrl, tempDir, [
        '--depth',
        '1',
      ]);

      return this.localScanner.scan(tempDir);
    } catch (err) {
      throw new Error(`GitHub scan failed: ${(err as Error).message}`);
    } finally {
      await fs.remove(tempDir);
    }
  }
}
