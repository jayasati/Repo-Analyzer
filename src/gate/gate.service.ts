// ── src/gate/gate.service.ts ──────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import {
  GateThresholds,
  GateContext,
  GateViolation,
  GateResult,
  GateMetric,
  GateSeverity,
} from './gate.types';

const DEFAULTS: Required<GateThresholds> = {
  minScore: 60,
  maxCycles: 0,
  maxSmells: 5,
  maxScoreDrop: 10,
  maxAvgFanOut: 4,
  minCouplingScore: 50,
  blockNewCriticalSmells: true,
};

const CRITICAL_SMELL_TYPES = new Set([
  'circular-dependency',
  'god-module',
  'package-tangle',
  'unstable-abstraction',
]);

@Injectable()
export class GateService {
  evaluate(
    current: GateContext,
    previous: GateContext | null,
    custom: GateThresholds = {},
  ): GateResult {
    const cfg = { ...DEFAULTS, ...custom };
    const violations: GateViolation[] = [];

    // ── Rule 1: Minimum overall score ─────────────────────────────────────────
    if (current.overallScore < cfg.minScore) {
      violations.push({
        rule: 'min-score',
        severity: 'error',
        message: `Overall score ${current.overallScore} is below minimum ${cfg.minScore}`,
        current: current.overallScore,
        suggestion:
          'Reduce coupling and fix high-severity smells to raise the score.',
      });
    }

    // ── Rule 2: Circular dependencies ─────────────────────────────────────────
    if (current.cycleCount > cfg.maxCycles) {
      violations.push({
        rule: 'max-cycles',
        severity: 'error',
        message: `${current.cycleCount} circular dependencies detected (max allowed: ${cfg.maxCycles})`,
        current: current.cycleCount,
        suggestion:
          'Break cycles by extracting shared abstractions into a common module.',
      });
    }

    // ── Rule 3: Smell count ───────────────────────────────────────────────────
    if (current.smellCount > cfg.maxSmells) {
      violations.push({
        rule: 'max-smells',
        severity: 'warning',
        message: `${current.smellCount} architecture smells detected (max allowed: ${cfg.maxSmells})`,
        current: current.smellCount,
        suggestion:
          'Prioritise high-severity smells first (god-module, package-tangle).',
      });
    }

    // ── Rule 4: Fan-out (coupling) ────────────────────────────────────────────
    if (current.avgFanOut > cfg.maxAvgFanOut) {
      violations.push({
        rule: 'max-avg-fanout',
        severity: 'warning',
        message: `Average fan-out ${current.avgFanOut.toFixed(2)} exceeds threshold ${cfg.maxAvgFanOut}`,
        current: current.avgFanOut,
        suggestion:
          'Apply Dependency Inversion: depend on abstractions, not concrete modules.',
      });
    }

    // ── Rule 5: Coupling score floor ──────────────────────────────────────────
    if (current.couplingScore < cfg.minCouplingScore) {
      violations.push({
        rule: 'min-coupling-score',
        severity: 'error',
        message: `Coupling score ${current.couplingScore} is below minimum ${cfg.minCouplingScore}`,
        current: current.couplingScore,
        suggestion: 'Introduce interfaces between tightly coupled modules.',
      });
    }

    // ── Regression rules (require a baseline) ────────────────────────────────
    if (previous) {
      const drop = previous.overallScore - current.overallScore;
      if (drop > cfg.maxScoreDrop) {
        violations.push({
          rule: 'score-regression',
          severity: 'error',
          message: `Score dropped by ${drop} points vs baseline (max allowed: ${cfg.maxScoreDrop})`,
          current: current.overallScore,
          previous: previous.overallScore,
          delta: -drop,
          suggestion:
            'Review recent changes — a large score drop indicates new smells or cycles.',
        });
      }

      // ── Rule 6: New critical smells introduced ────────────────────────────
      if (cfg.blockNewCriticalSmells) {
        const prevCritical = new Set(
          previous.smellTypes.filter((t) => CRITICAL_SMELL_TYPES.has(t)),
        );
        const newCritical = current.smellTypes.filter(
          (t) => CRITICAL_SMELL_TYPES.has(t) && !prevCritical.has(t),
        );
        if (newCritical.length > 0) {
          violations.push({
            rule: 'new-critical-smells',
            severity: 'error',
            message: `New critical smells introduced: ${newCritical.join(', ')}`,
            suggestion:
              'These smells were not present in the baseline. Revert or refactor before merging.',
          });
        }
      }

      // ── Rule 7: Cycle count increased ────────────────────────────────────
      if (current.cycleCount > previous.cycleCount) {
        violations.push({
          rule: 'cycle-regression',
          severity: 'error',
          message: `Circular dependencies increased from ${previous.cycleCount} to ${current.cycleCount}`,
          current: current.cycleCount,
          previous: previous.cycleCount,
          delta: current.cycleCount - previous.cycleCount,
          suggestion:
            'A new cycle was introduced. Check recent module imports for bidirectional dependencies.',
        });
      }
    }

    const hasErrors = violations.some((v) => v.severity === 'error');
    const hasWarnings = violations.some((v) => v.severity === 'warning');
    const passed = !hasErrors;
    const grade = this.computeGrade(
      current.overallScore,
      hasErrors,
      hasWarnings,
    );

    return {
      passed,
      grade,
      violations,
      metrics: this.buildMetrics(current, previous),
      summary: this.buildSummary(passed, grade, violations, current),
      reportBlock: this.buildReportBlock(passed, violations),
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeGrade(
    score: number,
    errors: boolean,
    warnings: boolean,
  ): GateResult['grade'] {
    if (errors) return score < 50 ? 'F' : 'D';
    if (warnings) return score >= 80 ? 'B' : 'C';
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    return 'C';
  }

  private buildMetrics(
    current: GateContext,
    previous: GateContext | null,
  ): GateMetric[] {
    const metric = (
      label: string,
      cur: number,
      prev: number | undefined,
      pass: boolean,
      warn?: boolean,
    ): GateMetric => ({
      label,
      current: cur,
      previous: prev,
      delta: prev != null ? cur - prev : undefined,
      status: pass ? 'pass' : warn ? 'warn' : 'fail',
    });

    return [
      metric(
        'Overall Score',
        current.overallScore,
        previous?.overallScore,
        current.overallScore >= DEFAULTS.minScore,
      ),
      metric(
        'Coupling Score',
        current.couplingScore,
        previous?.couplingScore,
        current.couplingScore >= DEFAULTS.minCouplingScore,
      ),
      metric(
        'Modularity Score',
        current.modularityScore,
        previous?.modularityScore,
        current.modularityScore >= 50,
      ),
      metric(
        'Cycles',
        current.cycleCount,
        previous?.cycleCount,
        current.cycleCount === 0,
      ),
      metric(
        'Smells',
        current.smellCount,
        previous?.smellCount,
        current.smellCount <= DEFAULTS.maxSmells,
        current.smellCount <= 10,
      ),
      metric(
        'Avg Fan-Out',
        Number(current.avgFanOut.toFixed(2)),
        previous ? Number(previous.avgFanOut.toFixed(2)) : undefined,
        current.avgFanOut <= DEFAULTS.maxAvgFanOut,
      ),
    ];
  }

  private buildSummary(
    passed: boolean,
    grade: string,
    violations: GateViolation[],
    current: GateContext,
  ): string {
    const errors = violations.filter((v) => v.severity === 'error').length;
    const warnings = violations.filter((v) => v.severity === 'warning').length;

    if (passed && warnings === 0) {
      return `✅ Architecture gate PASSED (Grade ${grade}). Score: ${current.overallScore}/100. No violations.`;
    }
    if (passed) {
      return `⚠️  Architecture gate PASSED with warnings (Grade ${grade}). ${warnings} warning(s). Score: ${current.overallScore}/100.`;
    }
    return `❌ Architecture gate FAILED (Grade ${grade}). ${errors} error(s), ${warnings} warning(s). Score: ${current.overallScore}/100. Fix all errors before merging.`;
  }

  private buildReportBlock(
    passed: boolean,
    violations: GateViolation[],
  ): string {
    if (passed && violations.length === 0) {
      return `note "✅ All architecture gates passed" as GateNote #lightgreen\n`;
    }
    const lines = violations
      .map(
        (v) =>
          `  ${v.severity === 'error' ? '❌' : '⚠️'} ${v.rule}: ${v.message}`,
      )
      .join('\\n');
    return `note "${passed ? '⚠️' : '❌'} Gate ${passed ? 'warnings' : 'failures'}:\\n${lines}" as GateNote #${passed ? 'lightyellow' : '#FFD0D0'}\n`;
  }
}
