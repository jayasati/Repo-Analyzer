
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

const LOCK_TTL_MS = 180_000; // 3 min (match analysis timeout)

/**
 * WHY: Without distributed locking, two concurrent requests for the same
 * GitHub URL spawn two clone+analysis cycles. The lock ensures only one
 * wins; the second waits and then hits the cache.
 */
@Injectable()
export class AnalysisLockService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async acquire(repoUrl: string, jobId: string): Promise<boolean> {
    const key = `analysis:lock:${encodeURIComponent(repoUrl)}`;
    // SET NX EX is atomic — safe for distributed use
    const result = await this.redis.set(key, jobId, 'PX', LOCK_TTL_MS, 'NX');
    return result === 'OK';
  }

  async release(repoUrl: string, jobId: string): Promise<void> {
    const key = `analysis:lock:${encodeURIComponent(repoUrl)}`;
    // Only release if we own the lock (Lua script for atomicity)
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, key, jobId);
  }
}