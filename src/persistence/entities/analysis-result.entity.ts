import {
  Column, CreateDateColumn, Entity,
  Index, PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('analysis_results')
export class AnalysisResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  repoUrl!: string;

  @Column()
  projectName!: string;

  @Column({ type: 'int' })
  overallScore!: number;

  @Column({ type: 'int' })
  modularityScore!: number;

  @Column({ type: 'int' })
  couplingScore!: number;

  @Column({ type: 'int' })
  smellsScore!: number;

  @Column({ type: 'int' })
  cycleCount!: number;

  @Column({ type: 'int' })
  smellCount!: number;

  @Column({ type: 'int' })
  moduleCount!: number;

  @Column({ nullable: true })
  detectedFramework?: string;

  @Column({ nullable: true })
  detectedLanguage?: string;

  @Column({ type: 'jsonb' })
  fullResult!: string; // JSON blob of full PipelineResult

  @CreateDateColumn()
  analyzedAt!: Date;
}