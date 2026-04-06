import { Injectable, NotFoundException } from '@nestjs/common';
import { HistoryService } from './history.service';

export interface AnalysisDiff {
  from: { id: string; analyzedAt: Date; score: number };
  to: { id: string; analyzedAt: Date; score: number };
  delta: {
    overallScore: number;
    modularityScore: number;
    couplingScore: number;
    smellsScore: number;
    cycleCount: number;
    smellCount: number;
    moduleCount: number;
  };
  regression: boolean; // true if overall score dropped
  newSmells: string[]; // smell types present in "to" but not in "from"
  fixedSmells: string[]; // smell types present in "from" but not in "to"
}

@Injectable()
export class DiffService {
  constructor(private readonly historyService: HistoryService) {}

  async compare(fromId: string, toId: string): Promise<AnalysisDiff> {
    const [fromEntity, toEntity] = await Promise.all([
      this.historyService.getById(fromId),
      this.historyService.getById(toId),
    ]);

    if (!fromEntity)
      throw new NotFoundException(`Analysis ${fromId} not found`);
    if (!toEntity) throw new NotFoundException(`Analysis ${toId} not found`);

    const fromResult = JSON.parse(fromEntity.fullResult);
    const toResult = JSON.parse(toEntity.fullResult);

    const fromSmellTypes = new Set<string>(
      (fromResult.smells ?? []).map((s: { type: string }) => s.type),
    );
    const toSmellTypes = new Set<string>(
      (toResult.smells ?? []).map((s: { type: string }) => s.type),
    );

    return {
      from: {
        id: fromId,
        analyzedAt: fromEntity.analyzedAt,
        score: fromEntity.overallScore,
      },
      to: {
        id: toId,
        analyzedAt: toEntity.analyzedAt,
        score: toEntity.overallScore,
      },
      delta: {
        overallScore: toEntity.overallScore - fromEntity.overallScore,
        modularityScore: toEntity.modularityScore - fromEntity.modularityScore,
        couplingScore: toEntity.couplingScore - fromEntity.couplingScore,
        smellsScore: toEntity.smellsScore - fromEntity.smellsScore,
        cycleCount: toEntity.cycleCount - fromEntity.cycleCount,
        smellCount: toEntity.smellCount - fromEntity.smellCount,
        moduleCount: toEntity.moduleCount - fromEntity.moduleCount,
      },
      regression: toEntity.overallScore < fromEntity.overallScore,
      newSmells: [...toSmellTypes].filter((t) => !fromSmellTypes.has(t)),
      fixedSmells: [...fromSmellTypes].filter((t) => !toSmellTypes.has(t)),
    };
  }
}
