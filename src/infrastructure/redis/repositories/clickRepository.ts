import type Redis from 'ioredis';
import { redisClient } from '../client';
import type { IClickRepository } from '../../../domain/repositories/IClickRepository';

export class ClickRedisRepository implements IClickRepository {
  private redis: Redis;

  constructor() {
    this.redis = redisClient.getClient();
  }

  /**
   * Increment user's click count in Redis
   */
  async incrementClickCount(userId: string, count: number): Promise<number> {
    const key = `clicks:pending:${userId}`;
    const newCount = await this.redis.incrby(key, count);

    // Set expiration to prevent memory leak if batch save fails
    await this.redis.expire(key, 300); // 5 minutes

    return newCount;
  }

  /**
   * Get pending click count for a user
   */
  async getPendingClicks(userId: string): Promise<number> {
    const key = `clicks:pending:${userId}`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Get all pending clicks for batch processing
   */
  async getAllPendingClicks(): Promise<Map<string, number>> {
    const keys = await this.redis.keys('clicks:pending:*');
    const result = new Map<string, number>();

    if (keys.length === 0) {
      return result;
    }

    const pipeline = this.redis.pipeline();
    keys.forEach((key) => {
      pipeline.get(key);
    });

    const values = await pipeline.exec();
    if (!values) return result;

    keys.forEach((key, index) => {
      const [error, value] = values[index] ?? [];
      if (!error && value) {
        const userId = key.split(':')[2];
        if (userId) {
          result.set(userId, parseInt(value as string, 10));
        }
      }
    });

    return result;
  }

  /**
   * Clear pending clicks after batch save
   */
  async clearPendingClicks(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;

    const pipeline = this.redis.pipeline();
    userIds.forEach((userId) => {
      pipeline.del(`clicks:pending:${userId}`);
    });

    await pipeline.exec();
  }

  /**
   * Add click event to stream for event sourcing
   */
  async addClickEvent(userId: string, count: number): Promise<string> {
    const streamKey = 'clicks:stream';
    const id = await this.redis.xadd(
      streamKey,
      'MAXLEN',
      '~',
      '10000',
      '*',
      'userId',
      userId,
      'count',
      count.toString(),
      'timestamp',
      Date.now().toString(),
    );

    return id ?? '';
  }

  /**
   * Read click events from stream
   */
  async readClickEvents(
    lastId = '0',
    count = 100,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      count: number;
      timestamp: number;
    }>
  > {
    const streamKey = 'clicks:stream';
    const results = await this.redis.xread('COUNT', count, 'STREAMS', streamKey, lastId);

    if (!results || results.length === 0) {
      return [];
    }

    const events = [];
    const [, messages] = results[0] ?? [];

    if (messages) {
      for (const [id, fields] of messages) {
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i] as string] = fields[i + 1] as string;
        }

        events.push({
          id,
          userId: data['userId'] ?? '',
          count: parseInt(data['count'] ?? '0', 10),
          timestamp: parseInt(data['timestamp'] ?? '0', 10),
        });
      }
    }

    return events;
  }
}
