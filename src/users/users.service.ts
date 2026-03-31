import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserEntity }   from './entities/user.entity';
import { ApiKeyEntity } from './entities/api-key.entity';
import { RegisterDto }  from '../auth/dto/register.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)   private readonly users:   Repository<UserEntity>,
    @InjectRepository(ApiKeyEntity) private readonly apiKeys: Repository<ApiKeyEntity>,
  ) {}

  async create(dto: RegisterDto): Promise<UserEntity> {
    const existing = await this.users.findOneBy({ email: dto.email });
    if (existing) throw new ConflictException('Email already registered');

    const user = this.users.create({
      email:        dto.email,
      passwordHash: dto.password, // @BeforeInsert hashes it
    });
    return this.users.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ email });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findOneBy({ id });
  }

  // ── API keys ──────────────────────────────────────────────────────────────

  /**
   * Generate a new API key for a user.
   *
   * Returns the plaintext key exactly once — it is never stored.
   * The hash is stored in the database.
   *
   * Key format: ra_<32 random hex chars>
   */
  async generateApiKey(userId: string, name?: string): Promise<{ key: string; id: string }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const rawKey = `ra_${randomBytes(16).toString('hex')}`;
    const prefix = rawKey.slice(0, 8);
    const hash   = await bcrypt.hash(rawKey, 10);

    const entity = this.apiKeys.create({
      keyHash: hash,
      prefix,
      name,
      userId,
      user,
      active: true,
    });
    const saved = await this.apiKeys.save(entity);

    return { key: rawKey, id: saved.id };
  }

  async listApiKeys(userId: string): Promise<Omit<ApiKeyEntity, 'keyHash'>[]> {
    const keys = await this.apiKeys.findBy({ userId, active: true });
    return keys.map(({ keyHash: _, ...rest }) => rest);
  }

  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    await this.apiKeys.update({ id: keyId, userId }, { active: false });
  }

  /**
   * Validate a raw API key — finds candidate by prefix, then bcrypt compares.
   * Returns the user if valid, null otherwise.
   */
  async validateApiKey(rawKey: string): Promise<UserEntity | null> {
    if (!rawKey.startsWith('ra_')) return null;

    const prefix = rawKey.slice(0, 8);
    const keys   = await this.apiKeys.find({
      where:    { prefix, active: true },
      relations: ['user'],
    });

    for (const key of keys) {
      const valid = await bcrypt.compare(rawKey, key.keyHash);
      if (valid) return key.user;
    }
    return null;
  }
}