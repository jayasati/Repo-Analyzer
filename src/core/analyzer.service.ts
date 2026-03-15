import { Injectable } from '@nestjs/common';
import * as fs   from 'fs-extra';
import * as fsNative from 'fs/promises';

import { GithubScannerService }    from '../input/github/github-scanner.service';
import { AnalysisPipelineService } from './pipeline/analysis-pipeline.service';
import { PipelineResult }          from './pipeline/pipeline-result.type';

@Injectable()
export class AnalyzerService {

  constructor(
    private readonly pipeline:      AnalysisPipelineService,
    private readonly githubScanner: GithubScannerService,
  ) {}

  async analyzeLocal(path: string): Promise<PipelineResult> {
    return this.pipeline.run(path);
  }

  async analyzeGitHub(repoUrl: string): Promise<PipelineResult> {
    const tempPath = await this.githubScanner.clone(repoUrl);

    try {
      return this.pipeline.run(tempPath);
    } finally {
      // Windows keeps git.exe file handles open briefly after clone.
      // We wait 500 ms then use Node's built-in fs.rm with maxRetries,
      // which handles EBUSY by retrying automatically.
      await this.safeRemove(tempPath);
    }
  }

  private async safeRemove(dirPath: string): Promise<void> {
    // Short delay lets git.exe release its locks on Windows
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Node 14.14+ supports maxRetries + retryDelay for EBUSY/ENOTEMPTY
      await fsNative.rm(dirPath, {
        recursive:  true,
        force:      true,
        maxRetries: 5,
        retryDelay: 300,
      });
    } catch (err) {
      // Fallback: try fs-extra remove, then give up silently
      try {
        await fs.remove(dirPath);
      } catch {
        console.warn(
          `[AnalyzerService] Could not remove temp dir "${dirPath}" — ` +
          `it can be deleted manually from .tmp/`
        );
      }
    }
  }
}