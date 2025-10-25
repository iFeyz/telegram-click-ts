import Redis from 'ioredis';
import { config } from '../../shared/config/env';
import { RedisError } from '../../shared/errors';
import { logger } from '../observability/logger';

export class RedisClient {
  private client: Redis | null = null;
  private static instance: RedisClient;

  private constructor() {}

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = new Redis(config.redis.url, {
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times: number): number => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('error', (error) => {
      logger.error({ message: 'Redis client error', error: error.message });
    });

    this.client.on('connect', () => {
      logger.info({ message: 'Redis client connected' });
    });

    this.client.on('ready', () => {
      logger.info({ message: 'Redis client ready' });
    });

    await this.client.ping();
  }

  public getClient(): Redis {
    if (!this.client) {
      throw new RedisError('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

export const redisClient = RedisClient.getInstance();
