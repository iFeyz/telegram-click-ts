import { RateLimiterRedisRepository } from '../../../infrastructure/redis/repositories/rateLimiterRepository';
import { redisClient } from '../../../infrastructure/redis/client';

describe('RateLimiterRedisRepository', () => {
  let repository: RateLimiterRedisRepository;

  beforeEach(async () => {
    repository = new RateLimiterRedisRepository();
    await redisClient.getClient().flushdb();
  });

  afterEach(async () => {
    await redisClient.getClient().flushdb();
  });

  describe('checkClickRateLimit', () => {
    it('should allow clicks within rate limit', async () => {
      const result = await repository.checkClickRateLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should track multiple clicks', async () => {
      await repository.checkClickRateLimit('user-1');
      await repository.checkClickRateLimit('user-1');
      const result = await repository.checkClickRateLimit('user-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThan(10);
    });

    it('should deny clicks when limit exceeded', async () => {
      for (let i = 0; i < 12; i++) {
        await repository.checkClickRateLimit('user-1');
      }

      const result = await repository.checkClickRateLimit('user-1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should maintain separate limits per user', async () => {
      for (let i = 0; i < 12; i++) {
        await repository.checkClickRateLimit('user-1');
      }

      const result1 = await repository.checkClickRateLimit('user-1');
      const result2 = await repository.checkClickRateLimit('user-2');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });

    it('should have resetAt in the future', async () => {
      const before = Date.now();
      const result = await repository.checkClickRateLimit('user-1');

      expect(result.resetAt.getTime()).toBeGreaterThan(before);
    });
  });

  describe('checkTelegramRateLimit', () => {
    it('should allow API calls within limit', async () => {
      const result = await repository.checkTelegramRateLimit('chat-1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should deny calls when limit exceeded', async () => {
      for (let i = 0; i < 32; i++) {
        await repository.checkTelegramRateLimit('chat-1');
      }

      const result = await repository.checkTelegramRateLimit('chat-1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should support custom limit per second', async () => {
      const result = await repository.checkTelegramRateLimit('chat-1', 5);

      expect(result.allowed).toBe(true);
    });

    it('should maintain separate limits per chat', async () => {
      for (let i = 0; i < 32; i++) {
        await repository.checkTelegramRateLimit('chat-1');
      }

      const result1 = await repository.checkTelegramRateLimit('chat-1');
      const result2 = await repository.checkTelegramRateLimit('chat-2');

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const result = await repository.checkRateLimit('api:user-1', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should deny requests when limit exceeded', async () => {
      for (let i = 0; i < 12; i++) {
        await repository.checkRateLimit('api:user-1', 10, 60);
      }

      const result = await repository.checkRateLimit('api:user-1', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should support different window sizes', async () => {
      const result1 = await repository.checkRateLimit('test:1', 5, 1);
      const result2 = await repository.checkRateLimit('test:2', 10, 60);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should support different rate limits', async () => {
      const result1 = await repository.checkRateLimit('test:1', 5, 60);
      const result2 = await repository.checkRateLimit('test:2', 100, 60);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBeGreaterThan(result1.remaining);
    });

    it('should handle concurrent requests', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(repository.checkRateLimit('test:concurrent', 10, 60));
      }

      const results = await Promise.all(requests);

      expect(results.every((r) => r.allowed)).toBe(true);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for identifier', async () => {
      for (let i = 0; i < 12; i++) {
        await repository.checkRateLimit('test:reset', 10, 60);
      }

      let result = await repository.checkRateLimit('test:reset', 10, 60);
      expect(result.allowed).toBe(false);

      await repository.resetRateLimit('test:reset');

      result = await repository.checkRateLimit('test:reset', 10, 60);
      expect(result.allowed).toBe(true);
    });

    it('should not affect other identifiers', async () => {
      for (let i = 0; i < 12; i++) {
        await repository.checkRateLimit('test:1', 10, 60);
      }

      await repository.resetRateLimit('test:1');

      const result1 = await repository.checkRateLimit('test:1', 10, 60);
      const result2 = await repository.checkRateLimit('test:2', 10, 60);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should not throw for non-existent identifier', async () => {
      await expect(repository.resetRateLimit('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current status without incrementing', async () => {
      await repository.checkRateLimit('test:status', 10, 60);
      await repository.checkRateLimit('test:status', 10, 60);

      const status = await repository.getRateLimitStatus('test:status', 10, 60);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBeGreaterThan(0);

      const statusAgain = await repository.getRateLimitStatus('test:status', 10, 60);

      expect(statusAgain.remaining).toBe(status.remaining);
    });

    it('should return correct status for exceeded limit', async () => {
      for (let i = 0; i < 12; i++) {
        await repository.checkRateLimit('test:exceeded', 10, 60);
      }

      const status = await repository.getRateLimitStatus('test:exceeded', 10, 60);

      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });

    it('should return allowed for new identifier', async () => {
      const status = await repository.getRateLimitStatus('new-key', 10, 60);

      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(10);
    });
  });

  describe('sliding window behavior', () => {
    it('should use sliding window algorithm', async () => {
      for (let i = 0; i < 10; i++) {
        await repository.checkRateLimit('test:sliding', 10, 1);
      }

      const result = await repository.checkRateLimit('test:sliding', 10, 1);
      expect(result.allowed).toBe(false);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const resultAfterWindow = await repository.checkRateLimit('test:sliding', 10, 1);
      expect(resultAfterWindow.allowed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero remaining correctly', async () => {
      for (let i = 0; i < 10; i++) {
        await repository.checkRateLimit('test:zero', 10, 60);
      }

      const result = await repository.checkRateLimit('test:zero', 10, 60);

      expect(result.remaining).toBe(0);
      expect(result.allowed).toBe(false);
    });

    it('should handle large rate limits', async () => {
      const result = await repository.checkRateLimit('test:large', 1000000, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(999990);
    });

    it('should handle small window sizes', async () => {
      const result = await repository.checkRateLimit('test:small-window', 5, 1);

      expect(result.allowed).toBe(true);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle special characters in identifier', async () => {
      const identifier = 'test:user@example.com:action';
      const result = await repository.checkRateLimit(identifier, 10, 60);

      expect(result.allowed).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should support multiple concurrent users', async () => {
      const users = Array.from({ length: 10 }, (_, i) => `user-${i}`);
      const results = await Promise.all(
        users.map((userId) => repository.checkClickRateLimit(userId)),
      );

      expect(results.every((r) => r.allowed)).toBe(true);
    });

    it('should handle burst traffic correctly', async () => {
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(repository.checkRateLimit('burst:test', 10, 60));
      }

      const results = await Promise.all(requests);
      const allowed = results.filter((r) => r.allowed).length;
      const denied = results.filter((r) => !r.allowed).length;

      expect(allowed).toBeLessThanOrEqual(10);
      expect(denied).toBeGreaterThan(0);
    });
  });
});
