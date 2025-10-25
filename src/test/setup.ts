import { redisClient } from '../infrastructure/redis/client';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.BOT_TOKEN = 'test-bot-token';
  process.env.ENABLE_OBSERVABILITY = 'false';
  process.env.ENABLE_LOKI = 'false';
  process.env.ENABLE_METRICS = 'false';

  await redisClient.connect();
});

afterAll(async () => {
  await redisClient.disconnect();
});
