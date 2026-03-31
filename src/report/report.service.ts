import { Injectable } from '@nestjs/common';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';
import { ReportFormat } from './report.types';

/**
 * Generates formatted reports from pipeline results.
 *
 * WHY three formats:
 * - JSON:     machine-readable, for CI/CD pipelines and API consumers
 * - Markdown: human-readable, for GitHub PR comments and documentation
 * - HTML:     self-contained, styled report for downloading and sharing
 */
@Injectable()
export class ReportService {

  generate(result: PipelineResult, format: ReportFormat): string {
    switch (format) {
      case 'markdown': return this.toMarkdown(result);
      case 'html':     return this.toHtml(result);
      case 'json':
      default:         return JSON.stringify(result, null, 2);
    }
  }

  // ── Markdown ───────────────────────────────────────────────────────────────

  private toMarkdown(r: PipelineResult): string {
    const score      = r.score.overall;
    const scoreEmoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
    const lines: string[] = [];

    lines.push(`# Architecture Report: ${r.projectName}`);
    lines.push('');
    lines.push(`> Generated at ${new Date().toISOString()}`);
    lines.push('');

    // Score summary
    lines.push('## Overall Score');
    lines.push('');
    lines.push(`${scoreEmoji} **${score} / 100**`);
    lines.push('');
    lines.push('| Dimension | Score |');
    lines.push('|-----------|-------|');
    lines.push(`| Modularity | ${r.score.breakdown.modularity} |`);
    lines.push(`| Coupling   | ${r.score.breakdown.coupling}   |`);
    lines.push(`| Smells     | ${r.score.breakdown.smells}     |`);
    lines.push('');

    // Detection
    lines.push('## Detection');
    lines.push('');
    lines.push(`- **Language**: ${r.detection.languages[0]?.name ?? 'unknown'}`);
    lines.push(`- **Framework**: ${r.detection.framework ?? 'none'}`);
    lines.push(`- **ORM**: ${r.detection.orm ?? 'none'}`);
    lines.push(`- **Confidence**: ${Math.round((r.detection.languages[0]?.confidence ?? 0) * 100)}%`);
    lines.push('');

    // Metrics
    lines.push('## Metrics');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Modules | ${r.metrics.moduleCount} |`);
    lines.push(`| Dependencies | ${r.metrics.dependencyCount} |`);
    lines.push(`| Cycles | ${r.metrics.cycleCount} |`);
    lines.push(`| Avg Fan-In | ${r.metrics.averageFanIn} |`);
    lines.push(`| Avg Fan-Out | ${r.metrics.averageFanOut} |`);
    lines.push(`| Max Fan-Out | ${r.metrics.maxFanOut} |`);
    lines.push(`| Density | ${(r.metrics.dependencyDensity * 100).toFixed(1)}% |`);
    lines.push('');

    // Health
    lines.push('## Health');
    lines.push('');
    if (r.health.strengths.length > 0) {
      lines.push('**Strengths:**');
      r.health.strengths.forEach(s => lines.push(`- ✅ ${s}`));
      lines.push('');
    }
    if (r.health.weaknesses.length > 0) {
      lines.push('**Weaknesses:**');
      r.health.weaknesses.forEach(w => lines.push(`- ⚠️ ${w}`));
      lines.push('');
    }

    // Smells
    lines.push('## Architecture Smells');
    lines.push('');
    if (r.smells.length === 0) {
      lines.push('✅ No architecture smells detected.');
    } else {
      r.smells.forEach(s => {
        const icon = s.severity === 'high' ? '🔴' : s.severity === 'medium' ? '🟡' : '⚪';
        lines.push(`${icon} **[${s.type}]** ${s.message}`);
      });
    }
    lines.push('');

    // Cycles
    lines.push('## Circular Dependencies');
    lines.push('');
    if (r.cycles.length === 0) {
      lines.push('✅ No circular dependencies detected.');
    } else {
      r.cycles.forEach(c => lines.push(`- \`${c.nodes.join(' → ')}\``));
    }
    lines.push('');

    // Hotspots
    if (r.hotspots.length > 0) {
      lines.push('## Hotspots');
      lines.push('');
      r.hotspots.forEach(h => {
        const risk = h.risk === 'high' ? '🔴' : '🟡';
        lines.push(`${risk} **${h.module}** — fan-out: ${h.fanOut}`);
      });
      lines.push('');
    }

    // Baseline
    if (r.baseline.length > 0) {
      lines.push('## Closest Architecture Pattern');
      lines.push('');
      const top = r.baseline[0];
      lines.push(`**${top.name}** (${Math.round(top.similarity * 100)}% match)`);
      lines.push('');
    }

    // Diagrams
    if (r.diagrams?.componentDiagram) {
      lines.push('## Component Diagram (PlantUML)');
      lines.push('');
      lines.push('```plantuml');
      lines.push(r.diagrams.componentDiagram);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  // ── HTML ───────────────────────────────────────────────────────────────────

  private toHtml(r: PipelineResult): string {
    const score      = r.score.overall;
    const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
    // const md         = this.toMarkdown(r);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Architecture Report — ${this.escapeHtml(r.projectName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #09090b; color: #fafafa; font-size: 14px; line-height: 1.6;
         padding: 40px 24px; }
  .container { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 600; margin-bottom: 8px; }
  h2 { font-size: 18px; font-weight: 600; margin: 32px 0 12px;
       border-bottom: 1px solid #27272a; padding-bottom: 8px; }
  .score-badge { display: inline-flex; align-items: center; gap: 10px;
                 background: #18181b; border: 1px solid #27272a;
                 border-radius: 12px; padding: 16px 24px; margin: 16px 0; }
  .score-big { font-size: 48px; font-weight: 700; color: ${scoreColor}; }
  .score-label { font-size: 13px; color: #71717a; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #27272a; }
  th { color: #71717a; font-weight: 500; font-size: 12px; text-transform: uppercase; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .tag-high   { background: #2d0f0f; color: #f87171; }
  .tag-medium { background: #2d1f04; color: #fcd34d; }
  .tag-low    { background: #1a1a1a; color: #71717a; }
  pre { background: #111113; border: 1px solid #27272a; border-radius: 8px;
        padding: 16px; overflow-x: auto; font-size: 12px; color: #a3e635; }
  .meta { color: #52525b; font-size: 12px; margin-bottom: 24px; }
  .good { color: #a3e635; } .bad { color: #f87171; }
  ul { padding-left: 20px; }
  li { margin: 4px 0; }
</style>
</head>
<body>
<div class="container">
  <h1>Architecture Report</h1>
  <p class="meta">Project: <strong>${this.escapeHtml(r.projectName)}</strong> &nbsp;·&nbsp; ${new Date().toISOString()}</p>

  <div class="score-badge">
    <div>
      <div class="score-big">${score}</div>
      <div class="score-label">/ 100 overall score</div>
    </div>
    <div style="margin-left:24px">
      <div>Modularity: <strong>${r.score.breakdown.modularity}</strong></div>
      <div>Coupling: <strong>${r.score.breakdown.coupling}</strong></div>
      <div>Smells: <strong>${r.score.breakdown.smells}</strong></div>
    </div>
  </div>

  <h2>Detection</h2>
  <table>
    <tr><th>Language</th><td>${this.escapeHtml(r.detection.languages[0]?.name ?? 'unknown')}</td></tr>
    <tr><th>Framework</th><td>${this.escapeHtml(r.detection.framework ?? 'none')}</td></tr>
    <tr><th>ORM</th><td>${this.escapeHtml(r.detection.orm ?? 'none')}</td></tr>
  </table>

  <h2>Metrics</h2>
  <table>
    <tr><th>Modules</th><td>${r.metrics.moduleCount}</td></tr>
    <tr><th>Dependencies</th><td>${r.metrics.dependencyCount}</td></tr>
    <tr><th>Cycles</th><td>${r.metrics.cycleCount}</td></tr>
    <tr><th>Avg Fan-In</th><td>${r.metrics.averageFanIn}</td></tr>
    <tr><th>Avg Fan-Out</th><td>${r.metrics.averageFanOut}</td></tr>
    <tr><th>Density</th><td>${(r.metrics.dependencyDensity * 100).toFixed(1)}%</td></tr>
  </table>

  <h2>Architecture Smells (${r.smells.length})</h2>
  ${r.smells.length === 0
    ? '<p class="good">✓ No architecture smells detected</p>'
    : `<ul>${r.smells.map(s =>
          `<li><span class="tag tag-${s.severity}">
            ${this.escapeHtml(s.severity)}
          </span>
          <strong>${this.escapeHtml(s.type)}</strong> —
          ${this.escapeHtml(s.message)}</li>`
        ).join('')}</ul>`
  }

  <h2>Circular Dependencies (${r.cycles.length})</h2>
  ${r.cycles.length === 0
    ? '<p class="good">✓ No circular dependencies</p>'
    : `<ul>${r.cycles.map(c =>
        `<li><code>${this.escapeHtml(c.nodes.join(' → '))}</code></li>`
      ).join('')}</ul>`
  }

  ${r.diagrams?.componentDiagram ? `
  <h2>Component Diagram (PlantUML)</h2>
  <pre>${this.escapeHtml(r.diagrams.componentDiagram)}</pre>
  ` : ''}
</div>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}