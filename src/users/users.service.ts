import {
  ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { RegisterDto } from '../auth/dto/register.dto';
import type { GithubValidatedUser } from '../auth/github.strategy';
import type { AuthUserPayload } from './users.types';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  async create(dto: RegisterDto): Promise<AuthUserPayload> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: passwordHash,
      },
      select: { id: true, email: true, role: true },
    });
    return user;
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<AuthUserPayload | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
  }

  async validatePassword(plain: string, passwordHash: string | null): Promise<boolean> {
    if (!passwordHash) return false;
    return bcrypt.compare(plain, passwordHash);
  }

  /**
   * Upsert user from GitHub OAuth: links githubId, rotates encrypted token.
   */
  async upsertFromGithub(oauth: GithubValidatedUser): Promise<AuthUserPayload> {
    const enc = this.tokenCrypto.encrypt(oauth.githubAccessToken);

    const byGithub = await this.prisma.user.findUnique({
      where: { githubId: oauth.githubId },
    });

    if (byGithub) {
      const user = await this.prisma.user.update({
        where: { id: byGithub.id },
        data: {
          email:             oauth.email,
          githubAccessToken: enc,
        },
        select: { id: true, email: true, role: true },
      });
      return user;
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email: oauth.email } });
    if (byEmail) {
      const user = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          githubId:          oauth.githubId,
          githubAccessToken: enc,
        },
        select: { id: true, email: true, role: true },
      });
      return user;
    }

    const user = await this.prisma.user.create({
      data: {
        email:             oauth.email,
        password:          null,
        githubId:          oauth.githubId,
        githubAccessToken: enc,
      },
      select: { id: true, email: true, role: true },
    });
    return user;
  }

  async getDecryptedGithubToken(userId: string): Promise<string> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubAccessToken: true },
    });
    if (!row?.githubAccessToken) {
      throw new NotFoundException('No GitHub account linked for this user');
    }
    return this.tokenCrypto.decrypt(row.githubAccessToken);
  }

  // ── API keys ──────────────────────────────────────────────────────────────

  async generateApiKey(userId: string, name?: string): Promise<{ key: string; id: string }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const rawKey = `ra_${randomBytes(16).toString('hex')}`;
    const prefix = rawKey.slice(0, 8);
    const hash = await bcrypt.hash(rawKey, 10);

    const saved = await this.prisma.apiKey.create({
      data: {
        keyHash: hash,
        prefix,
        name,
        userId,
      },
    });

    return { key: rawKey, id: saved.id };
  }

  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, active: true },
      select: {
        id: true, prefix: true, name: true, active: true, userId: true, createdAt: true,
      },
    });
  }

  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: { id: keyId, userId },
      data:  { active: false },
    });
  }

  async validateApiKey(rawKey: string): Promise<AuthUserPayload | null> {
    if (!rawKey.startsWith('ra_')) return null;

    const prefix = rawKey.slice(0, 8);
    const keys = await this.prisma.apiKey.findMany({
      where: { prefix, active: true },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    for (const key of keys) {
      const valid = await bcrypt.compare(rawKey, key.keyHash);
      if (valid) return key.user;
    }
    return null;
  }
}
