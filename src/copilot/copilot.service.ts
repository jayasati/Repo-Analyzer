// ── src/copilot/copilot.service.ts ───────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PipelineResult } from '../core/pipeline/pipeline-result.type';

export type CopilotQueryMode = 'freeform' | 'predefined';

export interface CopilotQuery {
  question: string;
  mode?: CopilotQueryMode;
}

export interface CopilotResponse {
  question: string;
  answer: string;
  evidence: string[];
  mentions: string[];
  confidence: 'high' | 'medium' | 'low';
  issues?: string[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

@Injectable()
export class CopilotService {
  async ask(
    result: PipelineResult,
    query: CopilotQuery,
  ): Promise<CopilotResponse> {
    const context = this.buildContext(result);

    // 🧩 STEP 1 — PLANNER
    const plannerOutput = await this.callLLM(
      this.buildPlannerPrompt(query.question, context),
    );

    // 🧩 STEP 2 — ANALYZER
    const analyzerOutput = await this.callLLM(
      this.buildAnalyzerPrompt(query.question, context, plannerOutput),
    );

    // 🧩 STEP 3 — VALIDATOR
    const validatorOutput = await this.callLLM(
      this.buildValidatorPrompt(context, plannerOutput, analyzerOutput),
    );

    return {
      question: query.question,
      answer: validatorOutput.validated_answer,
      evidence: analyzerOutput.evidence || [],
      mentions: this.extractMentions(
        validatorOutput.validated_answer,
        result,
      ),
      confidence: validatorOutput.confidence,
      issues: validatorOutput.issues_found || [],
    };
  }

  // ── CONTEXT BUILDER (UNCHANGED) ───────────────────────────────────────────
  private buildContext(r: PipelineResult): string {
    const smellLines =
      r.smells
        .map((s) => `  - [${s.severity.toUpperCase()}] ${s.type}: ${s.message}`)
        .join('\n') || '  none';

    const cycleLines =
      r.cycles.map((c) => `  - ${c.nodes.join(' → ')}`).join('\n') ||
      '  none';

    const hotspotLines =
      r.hotspots
        .slice(0, 8)
        .map(
          (h) =>
            `  - ${h.module} (risk: ${h.risk}, fan-out: ${h.fanOut})`,
        )
        .join('\n') || '  none';

    const baselineLine = r.baseline[0]
      ? `${r.baseline[0].name} (${Math.round(
          r.baseline[0].similarity * 100,
        )}% match)`
      : 'unknown';

    return `
PROJECT: ${r.projectName}
LANGUAGE: ${r.detection.languages[0]?.name ?? 'unknown'} | FRAMEWORK: ${
      r.detection.framework ?? 'none'
    } | ORM: ${r.detection.orm ?? 'none'}

ARCHITECTURE SCORE: ${r.score.overall}/100
  Modularity:  ${r.score.breakdown.modularity}
  Coupling:    ${r.score.breakdown.coupling}
  Smells:      ${r.score.breakdown.smells}

METRICS:
  Modules: ${r.metrics.moduleCount} | Dependencies: ${
      r.metrics.dependencyCount
    }
  Avg Fan-In: ${r.metrics.averageFanIn} | Avg Fan-Out: ${
      r.metrics.averageFanOut
    }
  Max Fan-Out: ${r.metrics.maxFanOut} | Density: ${(
      r.metrics.dependencyDensity * 100
    ).toFixed(1)}%

HEALTH: Strengths: [${r.health.strengths.join(
      ', ',
    )}] | Weaknesses: [${r.health.weaknesses.join(', ')}]

ARCHITECTURE SMELLS (${r.smells.length}):
${smellLines}

CIRCULAR DEPENDENCIES (${r.cycles.length}):
${cycleLines}

HOTSPOTS (${r.hotspots.length}):
${hotspotLines}

CLOSEST ARCHITECTURE PATTERN: ${baselineLine}
`.trim();
  }

  // ── 🧩 STEP 1: PLANNER PROMPT ─────────────────────────────────────────────
  private buildPlannerPrompt(question: string, context: string): string {
    return `
You are a PRINCIPAL SOFTWARE ARCHITECT acting as a PLANNER.

ANALYSIS DATA:
${context}

QUESTION:
${question}

TASK:
1. Extract modules
2. Extract signals (metrics, smells, hotspots, cycles)
3. Identify focus areas
4. Detect missing data

OUTPUT JSON:
{
  "modules": [],
  "signals": {
    "metrics": [],
    "smells": [],
    "hotspots": [],
    "cycles": []
  },
  "focus_areas": [],
  "missing_data": []
}

ONLY JSON.
`;
  }

  // ── 🧩 STEP 2: ANALYZER PROMPT ────────────────────────────────────────────
  private buildAnalyzerPrompt(
    question: string,
    context: string,
    planner: any,
  ): string {
    return `
You are a PRINCIPAL SOFTWARE ARCHITECT performing deep analysis.

ANALYSIS DATA:
${context}

PLANNER OUTPUT:
${JSON.stringify(planner)}

QUESTION:
${question}

TASK:
- Structural analysis
- Risk mapping
- Assumptions
- Recommendations

OUTPUT JSON:
{
  "answer": "",
  "evidence": [],
  "assumptions": []
}

ONLY JSON.
`;
  }

  // ── 🧩 STEP 3: VALIDATOR PROMPT ───────────────────────────────────────────
  private buildValidatorPrompt(
    context: string,
    planner: any,
    analyzer: any,
  ): string {
    return `
You are a PRINCIPAL SOFTWARE ARCHITECT acting as a VALIDATOR.

ANALYSIS DATA:
${context}

PLANNER OUTPUT:
${JSON.stringify(planner)}

ANALYZER OUTPUT:
${JSON.stringify(analyzer)}

TASK:
- Verify evidence
- Detect hallucinations
- Assign confidence

OUTPUT JSON:
{
  "validated_answer": "",
  "issues_found": [],
  "confidence": "high | medium | low"
}

ONLY JSON.
`;
  }

  // ── LLM CALL ──────────────────────────────────────────────────────────────
  private async callLLM(prompt: string): Promise<any> {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a strict JSON generator. Never output anything except JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';

    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  // ── MODULE MENTION EXTRACTION ─────────────────────────────────────────────
  private extractMentions(answer: string, result: PipelineResult): string[] {
    const moduleNames = [
      ...result.hotspots.map((h) => h.module),
      ...result.smells.map((s) => s.module).filter(Boolean),
    ] as string[];

    return moduleNames.filter((m) =>
      answer.toLowerCase().includes(m.toLowerCase()),
    );
  }
}

// ── PREDEFINED QUERIES ──────────────────────────────────────────────────────
export const PREDEFINED_QUERIES = [
  { id: 'scale', label: 'Why is my system hard to scale?' },
  { id: 'cycles', label: 'Explain my circular dependencies' },
  { id: 'hotspots', label: 'What are my riskiest modules?' },
  { id: 'clean', label: 'Am I violating clean architecture principles?' },
  { id: 'coupling', label: 'Which modules should I decouple first?' },
  { id: 'overview', label: 'Give me a plain-English overview' },
  { id: 'next', label: 'What should I refactor first?' },
];