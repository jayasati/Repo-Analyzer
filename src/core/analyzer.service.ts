// Analysis Orchestrator Service (CORE)

import { Injectable } from '@nestjs/common';
import { GithubScannerService } from '../input/github/github-scanner.service';
import * as fs from 'fs-extra';
import { AnalysisPipelineService } from "./pipeline/analysis-pipeline.service";
import { PipelineResult } from "./pipeline/pipeline-result.type";

@Injectable()
export class AnalyzerService {
  constructor(
    private readonly pipeline: AnalysisPipelineService,
    private readonly githubScanner: GithubScannerService
  ) {}

  async analyzeLocal(path: string): Promise<PipelineResult> {
    return this.pipeline.run(path);
  }

  async analyzeGitHub(repoUrl: string): Promise<PipelineResult> {
    const tempPath = await this.githubScanner.clone(repoUrl);

    try {
      return this.pipeline.run(tempPath);
    } finally {
      await fs.remove(tempPath);
    }
  }
}