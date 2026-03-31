import {
  Column, CreateDateColumn, Entity,
  Index, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  keyHash!: string;         // stored as bcrypt hash — never stored in plaintext

  @Column()
  prefix!: string;          // first 8 chars of key — used for display only

  @Column({ nullable: true })
  name?: string;            // user-given label e.g. "CI pipeline key"

  @Column({ default: true })
  active!: boolean;

  @ManyToOne(() => UserEntity, user => user.apiKeys, { onDelete: 'CASCADE' })
  user!: UserEntity;

  @Column({ type: 'uuid' })
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}