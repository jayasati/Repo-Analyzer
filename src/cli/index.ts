#!/usr/bin/env node

import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { AnalyzerService } from '../core/analyzer.service';

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

    const app = await NestFactory.createApplicationContext(AppModule);

    const analyzer = app.get(AnalyzerService);

    const result =
      source.startsWith('http')
        ? await analyzer.analyzeGitHub(source)
        : await analyzer.analyzeLocal(source);

    console.log(
      options.pretty
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result),
    );

    await app.close();
  });

program.parse();