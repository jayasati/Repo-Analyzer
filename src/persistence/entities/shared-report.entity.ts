import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('shared_reports')
export class SharedReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Unique share token for public access */
  @Index({ unique: true })
  @Column()
  shareToken!: string;

  /** The job ID of the analysis */
  @Column()
  jobId!: string;

  /** Repo URL for display */
  @Column()
  repoUrl!: string;

  @Column()
  projectName!: string;

  /** The full HTML report content (self-contained) */
  @Column({ type: 'text' })
  htmlContent!: string;

  /** Optional expiration date */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
