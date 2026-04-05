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
    const prompt  = this.buildPrompt(query.question, context);
    const raw     = await this.callOpenAI(prompt);

    return {
      question: query.question,
      answer: raw.answer,
      evidence: raw.evidence,
      mentions: this.extractMentions(raw.answer, result),
    };
  }

  // ── Context builder (UNCHANGED) ───────────────────────────────────────────
  private buildContext(r: PipelineResult): string {
    const smellLines = r.smells.map(
      s => `  - [${s.severity.toUpperCase()}] ${s.type}: ${s.message}`
    ).join('\n') || '  none';

    const cycleLines = r.cycles.map(
      c => `  - ${c.nodes.join(' → ')}`
    ).join('\n') || '  none';

    const hotspotLines = r.hotspots.slice(0, 8).map(
      h => `  - ${h.module} (risk: ${h.risk}, fan-out: ${h.fanOut})`
    ).join('\n') || '  none';

    const baselineLine = r.baseline[0]
      ? `${r.baseline[0].name} (${Math.round(r.baseline[0].similarity * 100)}% match)`
      : 'unknown';

    return `
PROJECT: ${r.projectName}
LANGUAGE: ${r.detection.languages[0]?.name ?? 'unknown'} | FRAMEWORK: ${r.detection.framework ?? 'none'} | ORM: ${r.detection.orm ?? 'none'}

ARCHITECTURE SCORE: ${r.score.overall}/100
  Modularity:  ${r.score.breakdown.modularity}
  Coupling:    ${r.score.breakdown.coupling}
  Smells:      ${r.score.breakdown.smells}

METRICS:
  Modules: ${r.metrics.moduleCount} | Dependencies: ${r.metrics.dependencyCount}
  Avg Fan-In: ${r.metrics.averageFanIn} | Avg Fan-Out: ${r.metrics.averageFanOut}
  Max Fan-Out: ${r.metrics.maxFanOut} | Density: ${(r.metrics.dependencyDensity * 100).toFixed(1)}%

HEALTH: Strengths: [${r.health.strengths.join(', ')}] | Weaknesses: [${r.health.weaknesses.join(', ')}]

ARCHITECTURE SMELLS (${r.smells.length}):
${smellLines}

CIRCULAR DEPENDENCIES (${r.cycles.length}):
${cycleLines}

HOTSPOTS (${r.hotspots.length}):
${hotspotLines}

CLOSEST ARCHITECTURE PATTERN: ${baselineLine}
`.trim();
  }

  // ── Prompt builder (UNCHANGED) ───────────────────────────────────────────
  private buildPrompt(question: string, context: string): string {
    return `You are an expert software architect reviewing a codebase. You have been given detailed static analysis results below. Answer the architect's question based ONLY on the data provided. Be specific, cite actual module names and metrics, and give actionable advice.

Always structure your response as valid JSON with this shape:
{
  "answer": "<your detailed answer in 2-4 paragraphs>",
  "evidence": ["<fact 1 from the data>", "<fact 2>", "<fact 3>"]
}

ANALYSIS DATA:
${context}

ARCHITECT'S QUESTION:
${question}

Respond ONLY with the JSON object, no markdown fences.`;
  }

  // ── OpenAI API call (NEW) ────────────────────────────────────────────────

  private async callOpenAI(
    prompt: string
  ): Promise<{ answer: string; evidence: string[] }> {

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini', // fast + cheap + strong
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: 'You are a senior software architect. Always respond in strict JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
    });

    const text = response.choices[0]?.message?.content ?? '{}';

    try {
      return JSON.parse(text);
    } catch {
      return { answer: text, evidence: [] };
    }
  }

  // ── Extract module mentions (UNCHANGED) ──────────────────────────────────
  private extractMentions(answer: string, result: PipelineResult): string[] {
    const moduleNames = [
      ...result.hotspots.map(h => h.module),
      ...result.smells.map(s => s.module).filter(Boolean),
    ] as string[];

    return moduleNames.filter(m =>
      answer.toLowerCase().includes(m.toLowerCase())
    );
  }

}

export const PREDEFINED_QUERIES = [
  { id: 'scale',     label: 'Why is my system hard to scale?' },
  { id: 'cycles',    label: 'Explain my circular dependencies' },
  { id: 'hotspots',  label: 'What are my riskiest modules?' },
  { id: 'clean',     label: 'Am I violating clean architecture principles?' },
  { id: 'coupling',  label: 'Which modules should I decouple first?' },
  { id: 'overview',  label: 'Give me a plain-English overview of this codebase' },
  { id: 'next',      label: 'What should I refactor first?' },
];