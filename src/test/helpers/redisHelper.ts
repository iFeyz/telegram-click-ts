import type Redis from 'ioredis';


export class RedisTestHelper {
  constructor(private redis: Redis) {}



  async clearPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async assertKeyExists(key: string): Promise<void> {
    const value = await this.redis.get(key);
    expect(value).not.toBeNull();
  }

  async assertKeyNotExists(key: string): Promise<void> {
    const value = await this.redis.get(key);
    expect(value).toBeNull();
  }

  async assertKeyValue(key: string, expectedValue: string): Promise<void> {
    const value = await this.redis.get(key);
    expect(value).toBe(expectedValue);
  }

  async assertZSetMember(key: string, member: string, expectedScore?: number): Promise<void> {
    const score = await this.redis.zscore(key, member);
    expect(score).not.toBeNull();
    if (expectedScore !== undefined) {
      expect(parseFloat(score!)).toBe(expectedScore);
    }
  }

  async assertZSetSize(key: string, expectedSize: number): Promise<void> {
    const size = await this.redis.zcard(key);
    expect(size).toBe(expectedSize);
  }

  async getZSetTopN(key: string, n: number): Promise<Array<{ member: string; score: number }>> {
    const results = await this.redis.zrevrange(key, 0, n - 1, 'WITHSCORES');
    const entries: Array<{ member: string; score: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      const member = results[i];
      const scoreStr = results[i + 1];
      if (member && scoreStr) {
        entries.push({
          member,
          score: parseFloat(scoreStr),
        });
      }
    }
    return entries;
  }

  async seedZSet(key: string, members: Array<{ member: string; score: number }>): Promise<void> {
    const args: (number | string)[] = [];
    for (const { score, member } of members) {
      args.push(score, member);
    }
    if (args.length > 0) {
      await this.redis.zadd(key, ...args);
    }
  }

  async assertTTL(key: string, minSeconds: number, maxSeconds: number): Promise<void> {
    const ttl = await this.redis.ttl(key);
    expect(ttl).toBeGreaterThanOrEqual(minSeconds);
    expect(ttl).toBeLessThanOrEqual(maxSeconds);
  }

  async waitForExpiration(key: string, timeoutMs = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const exists = await this.redis.get(key);
      if (!exists) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Key ${key} did not expire within ${timeoutMs}ms`);
  }
}

export function createRedisHelper(redis: Redis): RedisTestHelper {
  return new RedisTestHelper(redis);
}
