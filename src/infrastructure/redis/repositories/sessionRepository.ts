import type Redis from 'ioredis';
import { redisClient } from '../client';
import { config } from '../../../shared/config/env';
import type {
  ISessionRepository,
  SessionData,
} from '../../../domain/repositories/ISessionRepository';

export class SessionRedisRepository implements ISessionRepository {
  private redis: Redis;
  private readonly prefix = 'session:';
  private readonly ttl = config.session.timeoutMs / 1000;

  constructor() {
    this.redis = redisClient.getClient();
  }

  /**
   * Create or update a session
   */
  async setSession(token: string, data: SessionData): Promise<void> {
    const key = `${this.prefix}${token}`;
    const serialized = JSON.stringify({
      ...data,
      lastActivity: data.lastActivity.toISOString(),
    });

    await this.redis.setex(key, this.ttl, serialized);
  }

  /**
   * Get session data
   */
  async getSession(token: string): Promise<SessionData | null> {
    const key = `${this.prefix}${token}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const parsed = JSON.parse(data) as SessionData & { lastActivity: string };
    return {
      ...parsed,
      lastActivity: new Date(parsed.lastActivity),
    };
  }

  /**
   * Update session activity
   */
  async touchSession(token: string): Promise<boolean> {
    const session = await this.getSession(token);

    if (!session) {
      return false;
    }

    session.lastActivity = new Date();
    await this.setSession(token, session);
    return true;
  }

  /**
   * Delete a session
   */
  async deleteSession(token: string): Promise<void> {
    const key = `${this.prefix}${token}`;
    await this.redis.del(key);
  }

  /**
   * Check if session exists
   */
  async sessionExists(token: string): Promise<boolean> {
    const key = `${this.prefix}${token}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<string[]> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    const sessions: string[] = [];

    if (keys.length === 0) {
      return sessions;
    }

    const pipeline = this.redis.pipeline();
    keys.forEach((key) => {
      pipeline.get(key);
    });

    const results = await pipeline.exec();

    keys.forEach((key, index) => {
      const [error, value] = results?.[index] ?? [];
      if (!error && value) {
        try {
          const data = JSON.parse(value as string) as SessionData;
          if (data.userId === userId) {
            sessions.push(key.replace(this.prefix, ''));
          }
        } catch {}
      }
    });

    return sessions;
  }

  /**
   * Clear all sessions for a user
   */
  async clearUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    if (sessions.length > 0) {
      const pipeline = this.redis.pipeline();
      sessions.forEach((token) => {
        pipeline.del(`${this.prefix}${token}`);
      });
      await pipeline.exec();
    }
  }

  /**
   * Update session click count
   */
  async incrementClickCount(token: string, increment: number): Promise<number> {
    const session = await this.getSession(token);

    if (!session) {
      throw new Error('Session not found');
    }

    session.clickCount += increment;
    session.lastActivity = new Date();
    await this.setSession(token, session);

    return session.clickCount;
  }

  /**
   * Get total active sessions count
   */
  async getActiveSessionsCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    return keys.length;
  }

  /**
   * Clean up expired sessions (called by worker)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    let cleaned = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -2) {
        cleaned++;
      } else if (ttl === -1) {
        await this.redis.expire(key, this.ttl);
      }
    }

    return cleaned;
  }
}
