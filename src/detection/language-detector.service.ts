import { Injectable } from '@nestjs/common';
import { FileNode } from '../../src/shared/types/file-node.type';
import { DetectionResult, DetectedLanguage } from './detection-result.type';

@Injectable()
export class LanguageDetectorService {

  private collectExtensions(node: FileNode, acc: Record<string, number> = {}) {
    if (node.type === 'file') {
      const ext = node.path.split('.').pop() ?? '';
      acc[ext] = (acc[ext] || 0) + 1;
    }
    node.children?.forEach(child => this.collectExtensions(child, acc));
    return acc;
  }

  private detectLanguages(extMap: Record<string, number>): DetectedLanguage[] {
    const total = Object.values(extMap).reduce((a, b) => a + b, 0);

    const mapping: Record<string, string> = {
      ts: 'TypeScript',
      js: 'JavaScript',
      py: 'Python',
      java: 'Java',
      go: 'Go',
      rs: 'Rust',
      cpp: 'C++',
      c: 'C',
    };

    return Object.entries(extMap)
      .filter(([ext]) => mapping[ext])
      .map(([ext, count]) => ({
        name: mapping[ext],
        confidence: Number((count / total).toFixed(2)),
      }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  private hasNestJsSignals(node: FileNode): boolean {
    let found = false;
    const visit = (n: FileNode) => {
      if (n.path.endsWith('app.module.ts') || n.path.endsWith('main.ts')) {
        found = true;
        return;
      }
      n.children?.forEach(visit);
    };
    visit(node);
    return found;
  }

  private hasPrismaSignals(node: FileNode): boolean {
    let found = false;
    const visit = (n: FileNode) => {
      if (n.path.endsWith('schema.prisma')) {
        found = true;
        return;
      }
      n.children?.forEach(visit);
    };
    visit(node);
    return found;
  }

  detect(fileTree: FileNode): DetectionResult {
    const extensions = this.collectExtensions(fileTree);
    const languages = this.detectLanguages(extensions);
    const hasNest = this.hasNestJsSignals(fileTree);
    const hasPrisma = this.hasPrismaSignals(fileTree);

    return {
      languages,
      framework: hasNest ? 'nestjs' : undefined,
      orm: hasPrisma ? 'prisma' : undefined,
      analysisDepth: hasNest ? 'framework' : 'structural',
    };
  }
}