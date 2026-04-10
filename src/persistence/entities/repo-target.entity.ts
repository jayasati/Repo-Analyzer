import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('repo_targets')
export class RepoTargetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  repoUrl!: string;

  /** Target overall score (0-100) */
  @Column({ type: 'int', default: 80 })
  targetScore!: number;

  /** Target max smell count */
  @Column({ type: 'int', default: 0 })
  targetMaxSmells!: number;

  /** Target max cycle count */
  @Column({ type: 'int', default: 0 })
  targetMaxCycles!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
