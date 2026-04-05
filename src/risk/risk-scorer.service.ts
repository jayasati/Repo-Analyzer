
// Architectural Risk Score formula:
//
//   risk(module) = w_centrality × centrality(module)
//               + w_churn       × churn(module)
//               + w_coupling    × coupling(module)
//
// where each factor is normalised to [0, 1].
//
// centrality = PageRank-style: how many other modules depend on this one
//              (fan-in) relative to the max.
// churn      = commit frequency from GitChurnService (0 = never changes, 1 = hottest)
// coupling   = fan-out / max_fan_out
//
// Result:
//   risk < 0.3  →  🟢 LOW
//   risk < 0.6  →  🟡 MEDIUM
//   risk < 0.8  →  🟠 HIGH
//   risk ≥ 0.8  →  🔴 CRITICAL

import { Injectable } from '@nestjs/common';
import { ChurnEntry }  from './git-churn.service';

export interface RiskZone {
  module:      string;
  riskScore:   number;
  level:       'low' | 'medium' | 'high' | 'critical';
  factors: {
    centrality: number;
    churn:      number;
    coupling:   number;
  };
  /** Human-readable explanation for this module's risk */
  explanation: string;
  /** Actionable fix suggestion */
  recommendation: string;
}

export interface RiskReport {
  zones:       RiskZone[];
  criticalCount: number;
  highCount:     number;
  summary:       string;
}

const WEIGHTS = {
  centrality: 0.40,
  churn:      0.35,
  coupling:   0.25,
} as const;

@Injectable()
export class RiskScorerService {

  compute(
    packageEdges: { from: string; to: string }[],
    churnData:    ChurnEntry[],
  ): RiskReport {
    // ── Build per-module stats ───────────────────────────────────────────────
    const fanIn  = new Map<string, number>();
    const fanOut = new Map<string, number>();
    const modules = new Set<string>();

    for (const { from, to } of packageEdges) {
      modules.add(from); modules.add(to);
      fanIn.set(to,   (fanIn.get(to)   ?? 0) + 1);
      fanOut.set(from,(fanOut.get(from) ?? 0) + 1);
    }

    const maxFanIn  = Math.max(...Array.from(fanIn.values()),  1);
    const maxFanOut = Math.max(...Array.from(fanOut.values()), 1);

    const churnMap = new Map(churnData.map(c => [c.module, c.churnScore]));

    // ── Score each module ────────────────────────────────────────────────────
    const zones: RiskZone[] = Array.from(modules).map(module => {
      const centrality = (fanIn.get(module)  ?? 0) / maxFanIn;
      const coupling   = (fanOut.get(module) ?? 0) / maxFanOut;
      const churn      = churnMap.get(module) ?? 0;

      const riskScore =
        WEIGHTS.centrality * centrality +
        WEIGHTS.churn      * churn      +
        WEIGHTS.coupling   * coupling;

      const level = this.toLevel(riskScore);

      return {
        module,
        riskScore: Number(riskScore.toFixed(3)),
        level,
        factors: {
          centrality: Number(centrality.toFixed(3)),
          churn:      Number(churn.toFixed(3)),
          coupling:   Number(coupling.toFixed(3)),
        },
        explanation:    this.explain(module, centrality, churn, coupling),
        recommendation: this.recommend(level, centrality, churn, coupling),
      };
    });

    zones.sort((a, b) => b.riskScore - a.riskScore);

    const criticalCount = zones.filter(z => z.level === 'critical').length;
    const highCount     = zones.filter(z => z.level === 'high').length;

    return {
      zones,
      criticalCount,
      highCount,
      summary: this.buildSummary(zones, criticalCount, highCount),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toLevel(score: number): RiskZone['level'] {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  private explain(
    module:      string,
    centrality:  number,
    churn:       number,
    coupling:    number,
  ): string {
    const parts: string[] = [];
    if (centrality > 0.6) parts.push(`heavily depended on by other modules (centrality: ${(centrality * 100).toFixed(0)}%)`);
    if (churn      > 0.6) parts.push(`changes very frequently (churn: ${(churn * 100).toFixed(0)}% of max)`);
    if (coupling   > 0.6) parts.push(`has many outgoing dependencies (coupling: ${(coupling * 100).toFixed(0)}%)`);
    if (parts.length === 0) return `${module} has low risk across all factors.`;
    return `${module} is risky because it is ${parts.join(' and ')}.`;
  }

  private recommend(
    level:      RiskZone['level'],
    centrality: number,
    churn:      number,
    coupling:   number,
  ): string {
    if (level === 'low')    return 'No action required.';
    if (centrality > churn && centrality > coupling) {
      return 'Many modules depend on this one — introduce an interface or facade to isolate consumers from changes.';
    }
    if (churn > centrality && churn > coupling) {
      return 'This module changes often — reduce its blast radius by splitting it into stable and volatile sub-modules.';
    }
    return 'High fan-out detected — apply Dependency Inversion: depend on abstractions rather than concrete modules.';
  }

  private buildSummary(zones: RiskZone[], critical: number, high: number): string {
    if (critical === 0 && high === 0) return '✅ No high-risk architectural zones detected.';
    const top = zones[0];
    return `🔴 ${critical} critical + 🟠 ${high} high-risk module(s). Top risk: ${top.module} (score: ${top.riskScore}).`;
  }
}