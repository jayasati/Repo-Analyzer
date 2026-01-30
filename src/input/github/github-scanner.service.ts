import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
import simpleGit from 'simple-git';

@Injectable()
export class GithubScannerService {
  private readonly git = simpleGit();

  async clone(repoUrl: string): Promise<string> {
    const tempDir = path.join(
      process.cwd(),
      '.tmp',
      `repo-${Date.now()}`
    );

    await fs.ensureDir(tempDir);
    await this.git.clone(repoUrl, tempDir, ['--depth', '1']);

    return tempDir;
  }
}

