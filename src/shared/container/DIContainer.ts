import { PrismaClient } from '../../generated/prisma';
import { redisClient } from '../../infrastructure/redis/client';
import { ClickRedisRepository } from '../../infrastructure/redis/repositories/clickRepository';
import { LeaderboardRedisRepository } from '../../infrastructure/redis/repositories/leaderboardRepository';
import { RateLimiterRedisRepository } from '../../infrastructure/redis/repositories/rateLimiterRepository';
import { SessionRedisRepository } from '../../infrastructure/redis/repositories/sessionRepository';
import { TelegramBot } from '../../infrastructure/telegram/bot';
import { BatchSaveWorker } from '../../application/workers/BatchSaveWorker';
import { MessageQueueService } from '../../application/services/MessageQueueService';
import { QueuedMessageService } from '../../application/services/QueuedMessageService';
import type { IClickRepository } from '../../domain/repositories/IClickRepository';
import type { ILeaderboardRepository } from '../../domain/repositories/ILeaderboardRepository';
import type { IRateLimiterRepository } from '../../domain/repositories/IRateLimiterRepository';
import type { ISessionRepository } from '../../domain/repositories/ISessionRepository';
import { logger } from '../../infrastructure/observability/logger';

/**
 * Dependency Injection Container
 * Manages all service instances and their dependencies
 */
export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, unknown> = new Map();

  private constructor() {}

  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    // Initialize Redis connection
    await redisClient.connect();

    // Initialize Prisma
    const prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
    await prisma.$connect();
    this.services.set('prisma', prisma);

    // Initialize repositories
    this.services.set('clickRepository', new ClickRedisRepository());
    this.services.set('leaderboardRepository', new LeaderboardRedisRepository());
    this.services.set('rateLimiterRepository', new RateLimiterRedisRepository());
    this.services.set('sessionRepository', new SessionRedisRepository());

    // Initialize Telegram bot
    const bot = new TelegramBot();
    this.services.set('bot', bot);

    // Initialize MessageQueueService for rate-limited message sending
    const messageQueue = new MessageQueueService(bot.getBotInstance());
    this.services.set('messageQueue', messageQueue);

    // Initialize QueuedMessageService wrapper
    const queuedMessageService = new QueuedMessageService(messageQueue);
    this.services.set('queuedMessageService', queuedMessageService);

    // Initialize and start BatchSaveWorker
    const batchSaveWorker = new BatchSaveWorker(prisma, redisClient);
    this.services.set('batchSaveWorker', batchSaveWorker);
    batchSaveWorker.start();

    logger.info({ message: 'DI Container initialized successfully' });

    // Start the Telegram bot
    await bot.start();
  }

  /**
   * Get Prisma client
   */
  public getPrisma(): PrismaClient {
    const prisma = this.services.get('prisma') as PrismaClient;
    if (!prisma) {
      throw new Error('Prisma not initialized');
    }
    return prisma;
  }

  /**
   * Get Click Repository
   */
  public getClickRepository(): IClickRepository {
    const repo = this.services.get('clickRepository') as IClickRepository;
    if (!repo) {
      throw new Error('ClickRepository not initialized');
    }
    return repo;
  }

  /**
   * Get Leaderboard Repository
   */
  public getLeaderboardRepository(): ILeaderboardRepository {
    const repo = this.services.get('leaderboardRepository') as ILeaderboardRepository;
    if (!repo) {
      throw new Error('LeaderboardRepository not initialized');
    }
    return repo;
  }

  /**
   * Get Rate Limiter Repository
   */
  public getRateLimiterRepository(): IRateLimiterRepository {
    const repo = this.services.get('rateLimiterRepository') as IRateLimiterRepository;
    if (!repo) {
      throw new Error('RateLimiterRepository not initialized');
    }
    return repo;
  }

  /**
   * Get Session Repository
   */
  public getSessionRepository(): ISessionRepository {
    const repo = this.services.get('sessionRepository') as ISessionRepository;
    if (!repo) {
      throw new Error('SessionRepository not initialized');
    }
    return repo;
  }

  /**
   * Get Telegram Bot
   */
  public getTelegramBot(): TelegramBot {
    const bot = this.services.get('bot') as TelegramBot;
    if (!bot) {
      throw new Error('TelegramBot not initialized');
    }
    return bot;
  }

  /**
   * Get Batch Save Worker
   */
  public getBatchSaveWorker(): BatchSaveWorker {
    const worker = this.services.get('batchSaveWorker') as BatchSaveWorker;
    if (!worker) {
      throw new Error('BatchSaveWorker not initialized');
    }
    return worker;
  }

  /**
   * Get Message Queue Service
   */
  public getMessageQueue(): MessageQueueService {
    const queue = this.services.get('messageQueue') as MessageQueueService;
    if (!queue) {
      throw new Error('MessageQueueService not initialized');
    }
    return queue;
  }

  /**
   * Get Queued Message Service
   */
  public getQueuedMessageService(): QueuedMessageService {
    const service = this.services.get('queuedMessageService') as QueuedMessageService;
    if (!service) {
      throw new Error('QueuedMessageService not initialized');
    }
    return service;
  }

  /**
   * Clean up all services
   */
  public async cleanup(): Promise<void> {
    const bot = this.services.get('bot') as TelegramBot;
    if (bot) {
      await bot.stop();
    }

    const messageQueue = this.services.get('messageQueue') as MessageQueueService;
    if (messageQueue) {
      await messageQueue.shutdown();
    }

    const batchSaveWorker = this.services.get('batchSaveWorker') as BatchSaveWorker;
    if (batchSaveWorker) {
      await batchSaveWorker.stop();
    }

    const prisma = this.services.get('prisma') as PrismaClient;
    if (prisma) {
      await prisma.$disconnect();
    }

    await redisClient.disconnect();
    this.services.clear();
    logger.info({ message: 'DI Container cleaned up' });
  }
}

export const container = DIContainer.getInstance();
