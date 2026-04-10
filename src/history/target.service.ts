import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepoTargetEntity } from '../persistence/entities/repo-target.entity';

export interface RepoTarget {
  repoUrl: string;
  targetScore: number;
  targetMaxSmells: number;
  targetMaxCycles: number;
}

@Injectable()
export class TargetService {
  constructor(
    @InjectRepository(RepoTargetEntity)
    private readonly repo: Repository<RepoTargetEntity>,
  ) {}

  async getTarget(repoUrl: string): Promise<RepoTarget> {
    const entity = await this.repo.findOneBy({ repoUrl });
    if (!entity) {
      // Return defaults
      return {
        repoUrl,
        targetScore: 80,
        targetMaxSmells: 0,
        targetMaxCycles: 0,
      };
    }
    return {
      repoUrl: entity.repoUrl,
      targetScore: entity.targetScore,
      targetMaxSmells: entity.targetMaxSmells,
      targetMaxCycles: entity.targetMaxCycles,
    };
  }

  async setTarget(
    repoUrl: string,
    target: Partial<Omit<RepoTarget, 'repoUrl'>>,
  ): Promise<RepoTarget> {
    let entity = await this.repo.findOneBy({ repoUrl });

    if (!entity) {
      entity = this.repo.create({
        repoUrl,
        targetScore: target.targetScore ?? 80,
        targetMaxSmells: target.targetMaxSmells ?? 0,
        targetMaxCycles: target.targetMaxCycles ?? 0,
      });
    } else {
      if (target.targetScore !== undefined)
        entity.targetScore = target.targetScore;
      if (target.targetMaxSmells !== undefined)
        entity.targetMaxSmells = target.targetMaxSmells;
      if (target.targetMaxCycles !== undefined)
        entity.targetMaxCycles = target.targetMaxCycles;
    }

    const saved = await this.repo.save(entity);
    return {
      repoUrl: saved.repoUrl,
      targetScore: saved.targetScore,
      targetMaxSmells: saved.targetMaxSmells,
      targetMaxCycles: saved.targetMaxCycles,
    };
  }
}
