import { ArchitectureReport } from "./architecture-report.types";

export class ArchitectureReportService {

  generate(report: ArchitectureReport) {

    return {
      cli: this.generateCLI(report),
      json: this.generateJSON(report),
      markdown: this.generateMarkdown(report),
    };

  }

  private generateCLI(report: ArchitectureReport): string {

    const lines: string[] = [];

    lines.push(`Project: ${report.projectName}`);
    lines.push("");

    lines.push("Modules:");
    report.modules.forEach(m => lines.push(`- ${m}`));

    lines.push("");

    lines.push(`Architecture Score: ${report.score.overall}/100`);

    lines.push("");
    lines.push("Breakdown:");
    lines.push(`- Modularity: ${report.score.breakdown.modularity}`);
    lines.push(`- Coupling: ${report.score.breakdown.coupling}`);
    lines.push(`- Smells: ${report.score.breakdown.smells}`);

    lines.push("");

    lines.push("Detected Smells:");

    if (report.smells.length === 0)
      lines.push("None");

    report.smells.forEach(s =>
      lines.push(`- ${s.message}`)
    );

    lines.push("");

    lines.push("Detected Cycles:");

    if (report.cycles.length === 0)
      lines.push("None");

    report.cycles.forEach(c =>
      lines.push(`- ${c.nodes.join(" → ")}`)
    );

    lines.push("");
    lines.push("Recommendations:");

    if (report.recommendations.length === 0)
    lines.push("None");

    report.recommendations.forEach(r =>
    lines.push(`- ${r.message}`)
    );

    return lines.join("\n");
  }

  private generateJSON(report: ArchitectureReport) {

    return JSON.stringify(report, null, 2);

  }

  private generateMarkdown(report: ArchitectureReport): string {

    const lines: string[] = [];

    lines.push(`# Architecture Report`);
    lines.push("");
    lines.push(`**Project:** ${report.projectName}`);
    lines.push("");

    lines.push(`## Architecture Score`);
    lines.push(`${report.score.overall}/100`);
    lines.push("");

    lines.push(`### Breakdown`);
    lines.push(`- Modularity: ${report.score.breakdown.modularity}`);
    lines.push(`- Coupling: ${report.score.breakdown.coupling}`);
    lines.push(`- Smells: ${report.score.breakdown.smells}`);

    lines.push("");

    lines.push(`## Modules`);
    report.modules.forEach(m => lines.push(`- ${m}`));

    lines.push("");

    lines.push(`## Detected Smells`);
    if (report.smells.length === 0)
      lines.push(`None`);

    report.smells.forEach(s =>
      lines.push(`- ${s.message}`)
    );

    lines.push("");

    lines.push(`## Circular Dependencies`);

    if (report.cycles.length === 0)
      lines.push(`None`);

    report.cycles.forEach(c =>
      lines.push(`- ${c.nodes.join(" → ")}`)
    );

    return lines.join("\n");
  }

}