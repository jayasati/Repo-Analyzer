import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as fsNative from 'fs/promises';
import {
  GithubScannerService,
  CloneOptions,
} from '../input/github/github-scanner.service';
import { AnalysisPipelineService } from './pipeline/analysis-pipeline.service';
import { PipelineResult } from './pipeline/pipeline-result.type';
import { SourceTreeEntry } from '../copilot/source-tree.types';

@Injectable()
export class AnalyzerService {
  constructor(
    private readonly pipeline: AnalysisPipelineService,
    private readonly githubScanner: GithubScannerService,
  ) {}

  async analyzeLocal(path: string): Promise<PipelineResult> {
    return this.pipeline.run(path);
  }

  async analyzeLocalWithSourceTree(path: string): Promise<{
    result: PipelineResult;
    sourceTree: SourceTreeEntry[];
  }> {
    return this.pipeline.runWithSourceTree(path);
  }

  async analyzeGitHub(
    repoUrl: string,
    options: CloneOptions = {},
  ): Promise<PipelineResult> {
    const tempPath = await this.githubScanner.clone(repoUrl, options);
    try {
      return this.pipeline.run(tempPath);
    } finally {
      await this.githubScanner.safeRemove(tempPath);
    }
  }

  async analyzeGitHubWithSourceTree(
    repoUrl: string,
    options: CloneOptions = {},
  ): Promise<{
    result: PipelineResult;
    sourceTree: SourceTreeEntry[];
  }> {
    const tempPath = await this.githubScanner.clone(repoUrl, options);
    try {
      return this.pipeline.runWithSourceTree(tempPath);
    } finally {
      await this.githubScanner.safeRemove(tempPath);
    }
  }
}
