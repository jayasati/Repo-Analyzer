//Analysis Orchestrator Service (CORE)


import { Injectable } from '@nestjs/common';
import { LocalScannerService } from '../input/local/local-scanner.service';
import { GithubScannerService } from '../input/github/github-scanner.service';
import { LanguageDetectorService } from '../detection/language-detector.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';
import { computeStructuralMetrics } from '../structural/structural-metrics';
import { AnalysisResult } from './types/analysis-result.type';
import * as fs from 'fs-extra';

@Injectable()
export class AnalyzerService{
    constructor(
        private readonly localScanner :LocalScannerService,
        private readonly githubScanner :GithubScannerService,
        private readonly detector :LanguageDetectorService,
        private readonly structuralAnalyzer :StructuralAnalyzerService,
    ){}

    private extractProjectName(input: string): string {
    return input
        .replace(/\\/g, '/')
        .split('/')
        .pop() || 'unknown-project';
    }

    private runAnalysis(
        fileTree :any,
        source :'local' | 'github',
        identifier :string,
    ):AnalysisResult{

        const detection=this.detector.detect(fileTree);
        const graph=this.structuralAnalyzer.analyze(fileTree);
        const metrics=computeStructuralMetrics(graph);

        return {
            projectName:this.extractProjectName(identifier),
            source,
            analysisDepth:detection.analysisDepth,

            detection,
            fileTree,

            structural:{
                graph,
                metrics,
            },
        };
    }

    async analyzeLocal(path: string): Promise<AnalysisResult> {
        const fileTree = this.localScanner.scan(path);
        return this.runAnalysis(fileTree, 'local', path);
    }

    async analyzeGitHub(repoUrl: string): Promise<AnalysisResult> {
        const tempPath = await this.githubScanner.clone(repoUrl);

        try {
            const fileTree = this.localScanner.scan(tempPath);
            return this.runAnalysis(fileTree, 'github', repoUrl);
        } finally {
            await fs.remove(tempPath);
        }
    }

    

}