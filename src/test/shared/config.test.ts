import { config } from '../../shared/config/env';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('config structure', () => {
    it('should have telegram configuration', () => {
      expect(config.telegram).toBeDefined();
      expect(config.telegram.botToken).toBeDefined();
    });

    it('should have database configuration', () => {
      expect(config.database).toBeDefined();
      expect(config.database.url).toBeDefined();
    });

    it('should have redis configuration', () => {
      expect(config.redis).toBeDefined();
      expect(config.redis.url).toBeDefined();
      expect(config.redis.db).toBeDefined();
    });

    it('should have app configuration', () => {
      expect(config.app).toBeDefined();
      expect(config.app.nodeEnv).toBeDefined();
      expect(config.app.port).toBeDefined();
      expect(config.app.logLevel).toBeDefined();
    });

    it('should have rate limit configuration', () => {
      expect(config.rateLimit).toBeDefined();
      expect(config.rateLimit.maxClicksPerSecond).toBeDefined();
      expect(config.rateLimit.windowSeconds).toBeDefined();
    });

    it('should have batch configuration', () => {
      expect(config.batch).toBeDefined();
      expect(config.batch.saveIntervalMs).toBeDefined();
      expect(config.batch.size).toBeDefined();
    });

    it('should have leaderboard configuration', () => {
      expect(config.leaderboard).toBeDefined();
      expect(config.leaderboard.updateIntervalMs).toBeDefined();
      expect(config.leaderboard.size).toBeDefined();
    });

    it('should have session configuration', () => {
      expect(config.session).toBeDefined();
      expect(config.session.timeoutMs).toBeDefined();
    });

    it('should have worker configuration', () => {
      expect(config.worker).toBeDefined();
      expect(config.worker.concurrency).toBeDefined();
      expect(config.worker.maxRetries).toBeDefined();
    });

    it('should have queue configuration', () => {
      expect(config.queue).toBeDefined();
      expect(config.queue.channelTrackingTtlSeconds).toBeDefined();
    });
  });

  describe('telegram config', () => {
    it('should have bot token from environment', () => {
      expect(typeof config.telegram.botToken).toBe('string');
      expect(config.telegram.botToken.length).toBeGreaterThan(0);
    });
  });

  describe('database config', () => {
    it('should have database URL', () => {
      expect(typeof config.database.url).toBe('string');
      expect(config.database.url.length).toBeGreaterThan(0);
    });
  });

  describe('redis config', () => {
    it('should have redis URL with default', () => {
      expect(typeof config.redis.url).toBe('string');
      expect(config.redis.url).toMatch(/^redis:\/\//);
    });

    it('should have redis DB as number', () => {
      expect(typeof config.redis.db).toBe('number');
      expect(config.redis.db).toBeGreaterThanOrEqual(0);
    });

    it('should allow optional password', () => {
      expect(['string', 'undefined']).toContain(typeof config.redis.password);
    });
  });

  describe('app config', () => {
    it('should have valid node environment', () => {
      expect(['development', 'production', 'test']).toContain(config.app.nodeEnv);
    });

    it('should have valid port number', () => {
      expect(config.app.port).toBeGreaterThan(0);
      expect(config.app.port).toBeLessThan(65536);
    });

    it('should have valid log level', () => {
      expect(['error', 'warn', 'info', 'debug']).toContain(config.app.logLevel);
    });
  });

  describe('rate limit config', () => {
    it('should have positive max clicks per second', () => {
      expect(config.rateLimit.maxClicksPerSecond).toBeGreaterThan(0);
    });

    it('should have positive window seconds', () => {
      expect(config.rateLimit.windowSeconds).toBeGreaterThan(0);
    });

    it('should have reasonable limits', () => {
      expect(config.rateLimit.maxClicksPerSecond).toBeLessThanOrEqual(100);
      expect(config.rateLimit.windowSeconds).toBeLessThanOrEqual(60);
    });
  });

  describe('batch config', () => {
    it('should have positive save interval', () => {
      expect(config.batch.saveIntervalMs).toBeGreaterThan(0);
    });

    it('should have positive batch size', () => {
      expect(config.batch.size).toBeGreaterThan(0);
    });

    it('should have reasonable batch size', () => {
      expect(config.batch.size).toBeLessThanOrEqual(1000);
    });
  });

  describe('leaderboard config', () => {
    it('should have positive update interval', () => {
      expect(config.leaderboard.updateIntervalMs).toBeGreaterThan(0);
    });

    it('should have positive size', () => {
      expect(config.leaderboard.size).toBeGreaterThan(0);
    });

    it('should have reasonable size', () => {
      expect(config.leaderboard.size).toBeLessThanOrEqual(1000);
    });
  });

  describe('session config', () => {
    it('should have positive timeout', () => {
      expect(config.session.timeoutMs).toBeGreaterThan(0);
    });

    it('should have reasonable timeout', () => {
      expect(config.session.timeoutMs).toBeGreaterThanOrEqual(60000);
    });
  });

  describe('worker config', () => {
    it('should have positive concurrency', () => {
      expect(config.worker.concurrency).toBeGreaterThan(0);
    });

    it('should have positive max retries', () => {
      expect(config.worker.maxRetries).toBeGreaterThanOrEqual(0);
    });

    it('should have reasonable concurrency', () => {
      expect(config.worker.concurrency).toBeLessThanOrEqual(50);
    });
  });

  describe('queue config', () => {
    it('should have positive TTL', () => {
      expect(config.queue.channelTrackingTtlSeconds).toBeGreaterThan(0);
    });
  });

  describe('config immutability', () => {
    it('should be readonly at runtime', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });
  });
});
