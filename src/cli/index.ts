#!/usr/bin/env node

import { Command } from 'commander';

import { AnalyzerService } from '../core/analyzer.service';
import { LocalScannerService } from '../input/local/local-scanner.service';
import { GithubScannerService } from '../input/github/github-scanner.service';
import { LanguageDetectorService } from '../detection/language-detector.service';
import { StructuralAnalyzerService } from '../structural/structural-analyzer.service';

const program = new Command();

program
  .name('repo-analyzer')
  .description('Analyze local or GitHub repositories')
  .version('0.0.1');

program
  .command('scan')
  .argument('<source>', 'Local path or GitHub repository URL')
  .option('--pretty', 'Pretty-print output')
  .action(async (source, options) => {
    const analyzer = new AnalyzerService(
      new LocalScannerService(),
      new GithubScannerService(),
      new LanguageDetectorService(),
      new StructuralAnalyzerService(),
    );

    const result =
      source.startsWith('http')
        ? await analyzer.analyzeGitHub(source)
        : await analyzer.analyzeLocal(source);

    console.log(
      options.pretty
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result),
    );
  });

program.parse();
