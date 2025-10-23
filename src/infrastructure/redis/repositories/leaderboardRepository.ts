import type Redis from 'ioredis';
import { redisClient } from '../client';
import type {
  ILeaderboardRepository,
  LeaderboardEntry,
} from '../../../domain/repositories/ILeaderboardRepository';

export class LeaderboardRedisRepository implements ILeaderboardRepository {
  private redis: Redis;
  private readonly key = 'leaderboard:global';
  private readonly userDataPrefix = 'leaderboard:user:';

  constructor() {
    this.redis = redisClient.getClient();
  }

  /**
   * Update user score in the leaderboard
   */
  async updateScore(userId: string, score: number): Promise<void> {
    await this.redis.zadd(this.key, score, userId);
  }

  /**
   * Increment user score in the leaderboard
   */
  async incrementScore(userId: string, increment: number): Promise<number> {
    const newScore = await this.redis.zincrby(this.key, increment, userId);
    return parseFloat(newScore);
  }

  /**
   * Get user's rank (1-indexed)
   */
  async getUserRank(userId: string): Promise<number | null> {
    const rank = await this.redis.zrevrank(this.key, userId);
    return rank !== null ? rank + 1 : null;
  }

  /**
   * Get user's score
   */
  async getUserScore(userId: string): Promise<number> {
    const score = await this.redis.zscore(this.key, userId);
    return score ? parseFloat(score) : 0;
  }

  /**
   * Get top N users from leaderboard
   */
  async getTop(limit: number): Promise<Array<{ userId: string; score: number; rank: number }>> {
    const results = await this.redis.zrevrange(this.key, 0, limit - 1, 'WITHSCORES');

    const leaderboard: Array<{ userId: string; score: number; rank: number }> = [];

    for (let i = 0; i < results.length; i += 2) {
      const userId = results[i];
      const score = parseFloat(results[i + 1] ?? '0');

      if (userId) {
        leaderboard.push({
          userId,
          score,
          rank: Math.floor(i / 2) + 1,
        });
      }
    }

    return leaderboard;
  }

  /**
   * Get users around a specific user in the leaderboard
   */
  async getUserNeighbors(
    userId: string,
    above: number,
    below: number,
  ): Promise<Array<{ userId: string; score: number; rank: number }>> {
    const rank = await this.redis.zrevrank(this.key, userId);

    if (rank === null) {
      return [];
    }

    const start = Math.max(0, rank - above);
    const stop = rank + below;

    const results = await this.redis.zrevrange(this.key, start, stop, 'WITHSCORES');

    const neighbors: Array<{ userId: string; score: number; rank: number }> = [];

    for (let i = 0; i < results.length; i += 2) {
      const neighborUserId = results[i];
      const score = parseFloat(results[i + 1] ?? '0');

      if (neighborUserId) {
        neighbors.push({
          userId: neighborUserId,
          score,
          rank: start + Math.floor(i / 2) + 1,
        });
      }
    }

    return neighbors;
  }

  /**
   * Store user metadata for leaderboard display
   */
  async setUserData(userId: string, username: string): Promise<void> {
    const key = `${this.userDataPrefix}${userId}`;
    await this.redis.set(key, username, 'EX', 86400); // 24 hours expiry
  }

  /**
   * Get user metadata
   */
  async getUserData(userId: string): Promise<string | null> {
    const key = `${this.userDataPrefix}${userId}`;
    return this.redis.get(key);
  }

  /**
   * Get full leaderboard with user data
   */
  async getFullLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    const topUsers = await this.getTop(limit);

    const pipeline = this.redis.pipeline();
    topUsers.forEach((user) => {
      pipeline.get(`${this.userDataPrefix}${user.userId}`);
    });

    const userDataResults = await pipeline.exec();

    return topUsers.map((user, index) => {
      const [, username] = userDataResults?.[index] ?? [];
      return {
        userId: user.userId,
        username: (username as string) || 'Anonymous',
        score: user.score,
        rank: user.rank,
      };
    });
  }

  /**
   * Remove user from leaderboard
   */
  async removeUser(userId: string): Promise<void> {
    await this.redis.zrem(this.key, userId);
    await this.redis.del(`${this.userDataPrefix}${userId}`);
  }

  /**
   * Get total number of users in leaderboard
   */
  async getTotalUsers(): Promise<number> {
    return this.redis.zcard(this.key);
  }

  /**
   * Clear entire leaderboard
   */
  async clear(): Promise<void> {
    const keys = await this.redis.keys(`${this.userDataPrefix}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    await this.redis.del(this.key);
  }
}
