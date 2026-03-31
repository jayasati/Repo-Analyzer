import { ReportService } from './report.service';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';

const mockResult: Partial<PipelineResult> = {
  projectName: 'test-repo',
  score:       { overall: 75, breakdown: { modularity: 80, coupling: 70, smells: 75 } },
  detection:   { languages: [{ name: 'TypeScript', confidence: 0.9 }],
                 framework: 'nestjs', analysisDepth: 'framework' },
  metrics:     { moduleCount: 10, dependencyCount: 20, cycleCount: 0,
                 averageFanIn: 2, averageFanOut: 2, dependencyDensity: 0.1, maxFanOut: 5 },
  health:      { score: 75, strengths: ['High modularity'], weaknesses: [] },
  smells:      [],
  cycles:      [],
  hotspots:    [],
  baseline:    [{ name: 'nestjs-api', similarity: 0.85 }],
  diagrams:    {},
  confidence:  { score: 0.9, factors: { repoSizeFactor: 1, cyclePenalty: 0, smellPenalty: 0, stability: 0.9 } },
  summary:     { project: 'test', files: 50, dependencies: 20, modules: 10,
                 cycles: 0, smells: 0, architectureScore: 75 },
  impact:      undefined,
  unifiedGraph: { nodes: [], edges: [] },
};

describe('ReportService', () => {
  let svc: ReportService;
  beforeEach(() => { svc = new ReportService(); });

  it('generates valid JSON', () => {
    const output = svc.generate(mockResult as PipelineResult, 'json');
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed.projectName).toBe('test-repo');
  });

  it('generates markdown with expected sections', () => {
    const output = svc.generate(mockResult as PipelineResult, 'markdown');
    expect(output).toContain('# Architecture Report: test-repo');
    expect(output).toContain('## Overall Score');
    expect(output).toContain('## Metrics');
    expect(output).toContain('75 / 100');
  });

  it('includes score emoji green for score >= 80', () => {
    const highScore = { ...mockResult, score: { overall: 85, breakdown: { modularity: 85, coupling: 85, smells: 85 } } };
    const output = svc.generate(highScore as PipelineResult, 'markdown');
    expect(output).toContain('🟢');
  });

  it('includes score emoji red for score < 60', () => {
    const lowScore = { ...mockResult, score: { overall: 40, breakdown: { modularity: 40, coupling: 40, smells: 40 } } };
    const output = svc.generate(lowScore as PipelineResult, 'markdown');
    expect(output).toContain('🔴');
  });

  it('generates valid HTML with DOCTYPE', () => {
    const output = svc.generate(mockResult as PipelineResult, 'html');
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<title>Architecture Report');
    expect(output).toContain('test-repo');
  });

  it('escapes HTML special characters in report values', () => {
    const xssResult = {
      ...mockResult,
      projectName: '<script>alert("xss")</script>',
    };
    const output = svc.generate(xssResult as PipelineResult, 'html');
    expect(output).not.toContain('<script>alert');
  });
});