import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Encrypts OAuth tokens at rest (AES-256-GCM).
 * Requires TOKEN_ENCRYPTION_KEY: 32-byte value as base64 or 64-char hex.
 */
@Injectable()
export class TokenCryptoService {
  private getKey(): Buffer {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    if (!raw?.trim()) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY is required to store GitHub tokens (32 bytes, base64 or hex).',
      );
    }
    if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== KEY_LENGTH) {
      throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    }
    return buf;
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    const enc = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}
