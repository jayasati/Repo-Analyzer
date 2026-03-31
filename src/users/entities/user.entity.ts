import {
  BeforeInsert, Column, CreateDateColumn,
  Entity, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ApiKeyEntity } from './api-key.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ default: 'user' })
  role!: string;

  @OneToMany(() => ApiKeyEntity, key => key.user, { cascade: true })
  apiKeys!: ApiKeyEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @BeforeInsert()
  async hashPassword(): Promise<void> {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }

  async validatePassword(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.passwordHash);
  }
}