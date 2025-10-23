import type Redis from 'ioredis';
import { redisClient } from '../client';
import { config } from '../../../shared/config/env';
import type {
  IRateLimiterRepository,
  RateLimitResult,
} from '../../../domain/repositories/IRateLimiterRepository';

export class RateLimiterRedisRepository implements IRateLimiterRepository {
  private redis: Redis;

  constructor() {
    this.redis = redisClient.getClient();
  }

  /**
   * Check and update rate limit for user clicks
   */
  async checkClickRateLimit(userId: string): Promise<RateLimitResult> {
    const key = `ratelimit:click:${userId}`;
    const maxClicks = config.rateLimit.maxClicksPerSecond;
    const windowSeconds = config.rateLimit.windowSeconds;

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const pipeline = this.redis.pipeline();

    pipeline.zremrangebyscore(key, '-inf', windowStart);

    pipeline.zcard(key);

    pipeline.zadd(key, now, `${now}-${Math.random()}`);

    pipeline.expire(key, windowSeconds + 1);

    const results = await pipeline.exec();

    const count = (results?.[1]?.[1] as number) || 0;
    const allowed = count < maxClicks;

    return {
      allowed,
      remaining: Math.max(0, maxClicks - count - 1),
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }

  /**
   * Check rate limit for Telegram API calls
   */
  async checkTelegramRateLimit(chatId: string, limitPerSecond = 30): Promise<RateLimitResult> {
    const key = `ratelimit:telegram:${chatId}`;
    const windowSeconds = 1;

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const pipeline = this.redis.pipeline();

    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, windowSeconds + 1);

    const results = await pipeline.exec();

    const count = (results?.[1]?.[1] as number) || 0;
    const allowed = count < limitPerSecond;

    return {
      allowed,
      remaining: Math.max(0, limitPerSecond - count - 1),
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }

  /**
   * Generic rate limiter using sliding window
   */
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const pipeline = this.redis.pipeline();

    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, windowSeconds + 1);

    const results = await pipeline.exec();

    const count = (results?.[1]?.[1] as number) || 0;
    const allowed = count < maxRequests;

    return {
      allowed,
      remaining: Math.max(0, maxRequests - count - 1),
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(identifier: string): Promise<void> {
    await this.redis.del(`ratelimit:${identifier}`);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zcard(key);

    const results = await pipeline.exec();

    const count = (results?.[1]?.[1] as number) || 0;
    const allowed = count < maxRequests;

    return {
      allowed,
      remaining: Math.max(0, maxRequests - count),
      resetAt: new Date(now + windowSeconds * 1000),
    };
  }
}
