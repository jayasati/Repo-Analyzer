// ── src/gate/gate.types.ts ────────────────────────────────────────────────────
//
// Architecture Gates = CI/CD for system design.
// A gate is a named rule. If it fires, the gate fails (or warns).
// Every POST /gate/evaluate returns a GateResult the pipeline can act on.

export interface GateThresholds {
  /** Minimum overall architecture score to pass (default: 60) */
  minScore?: number;
  /** Maximum circular dependency count allowed (default: 0) */
  maxCycles?: number;
  /** Maximum smell count allowed (default: 5) */
  maxSmells?: number;
  /** Max allowed score regression vs previous analysis (default: -10) */
  maxScoreDrop?: number;
  /** Maximum average fan-out before gate fails (default: 4) */
  maxAvgFanOut?: number;
  /** Block if coupling score drops below this (default: 50) */
  minCouplingScore?: number;
  /** Block if new god-module / circular-dependency smells introduced */
  blockNewCriticalSmells?: boolean;
}

export interface GateContext {
  overallScore:    number;
  modularityScore: number;
  couplingScore:   number;
  smellsScore:     number;
  cycleCount:      number;
  smellCount:      number;
  avgFanOut:       number;
  smellTypes:      string[];
}

export type GateSeverity = 'error' | 'warning';

export interface GateViolation {
  rule:       string;
  severity:   GateSeverity;
  message:    string;
  current?:   number;
  previous?:  number;
  delta?:     number;
  suggestion: string;
}

export interface GateMetric {
  label:     string;
  current:   number | string;
  previous?: number | string;
  status:    'pass' | 'fail' | 'warn';
  delta?:    number;
}

export interface GateResult {
  passed:     boolean;
  grade:      'A' | 'B' | 'C' | 'D' | 'F';
  violations: GateViolation[];
  metrics:    GateMetric[];
  summary:    string;
  /** PlantUML-compatible annotation block for gate failures */
  reportBlock: string;
}

export interface EvaluateGateDto {
  /** Job ID from a completed analysis */
  jobId:      string;
  /** Optional: a previous jobId to diff against (regression detection) */
  baselineJobId?: string;
  /** Custom thresholds – overrides defaults */
  thresholds?: GateThresholds;
}