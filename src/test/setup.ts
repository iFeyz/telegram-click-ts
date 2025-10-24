import { redisClient } from '../infrastructure/redis/client';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.BOT_TOKEN = 'test-bot-token';

  await redisClient.connect();
});

afterAll(async () => {
  await redisClient.disconnect();
});
