import type { PrismaClient } from '../../generated/prisma';
import type { RedisClient } from '../../infrastructure/redis/client';
import { REDIS_KEYS, GAME_SETTINGS } from '../../shared/constants';

/**
 * Worker that periodically saves pending clicks from Redis to the database
 */
export class BatchSaveWorker {
  private prisma: PrismaClient;
  private redis: RedisClient;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private batchSize = 100;
  private intervalMs = GAME_SETTINGS.BATCH_SAVE_INTERVAL_MS;

  constructor(prisma: PrismaClient, redis: RedisClient) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Start the batch save worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('[BatchSaveWorker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[BatchSaveWorker] Starting with interval:', this.intervalMs, 'ms');

    void this.processBatch();

    this.intervalId = setInterval(() => {
      void this.processBatch();
    }, this.intervalMs);
  }

  /**
   * Stop the batch save worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    await this.processBatch();
    console.log('[BatchSaveWorker] Stopped');
  }

  /**
   * Process a batch of pending clicks
   */
  private async processBatch(): Promise<void> {
    if (!this.isRunning && this.intervalId) {
      return;
    }

    try {
      const startTime = Date.now();
      const client = this.redis.getClient();

      const pattern = `${REDIS_KEYS.CLICK_PENDING}*`;
      const keys = await client.keys(pattern);

      if (keys.length === 0) {
        return;
      }

      console.log(`[BatchSaveWorker] Processing ${keys.length} users with pending clicks`);

      for (let i = 0; i < keys.length; i += this.batchSize) {
        const batch = keys.slice(i, i + this.batchSize);
        await this.processBatchKeys(batch);
      }

      const duration = Date.now() - startTime;
      console.log(`[BatchSaveWorker] Batch processed in ${duration}ms`);
    } catch (error) {
      console.error('[BatchSaveWorker] Error processing batch:', error);
    }
  }

  /**
   * Process a batch of Redis keys
   */
  private async processBatchKeys(keys: string[]): Promise<void> {
    const client = this.redis.getClient();
    const updates: Array<{ userId: string; clicks: number }> = [];

    for (const key of keys) {
      const userId = key.replace(REDIS_KEYS.CLICK_PENDING, '');
      const clicks = await client.getdel(key);

      if (clicks && parseInt(clicks, 10) > 0) {
        updates.push({
          userId,
          clicks: parseInt(clicks, 10),
        });
      }
    }

    if (updates.length === 0) {
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const { userId, clicks } of updates) {
          await tx.user.update({
            where: { id: userId },
            data: {
              score: { increment: clicks },
              updatedAt: new Date(),
            },
          });

          await tx.click.create({
            data: {
              userId,
              count: clicks,
              timestamp: new Date(),
            },
          });
        }
      });

      console.log(`[BatchSaveWorker] Saved ${updates.length} user updates to database`);
    } catch (error) {
      console.error('[BatchSaveWorker] Database transaction failed:', error);

      for (const { userId, clicks } of updates) {
        await client.incrby(`${REDIS_KEYS.CLICK_PENDING}${userId}`, clicks);
      }

      throw error;
    }
  }

  /**
   * Force save all pending data (for graceful shutdown)
   */
  async forceSave(): Promise<void> {
    console.log('[BatchSaveWorker] Force saving all pending data...');
    await this.processBatch();
    console.log('[BatchSaveWorker] Force save completed');
  }

  /**
   * Get worker statistics
   */
  async getStats(): Promise<{
    isRunning: boolean;
    pendingUsers: number;
    totalPendingClicks: number;
  }> {
    const client = this.redis.getClient();
    const pattern = `${REDIS_KEYS.CLICK_PENDING}*`;
    const keys = await client.keys(pattern);

    let totalPendingClicks = 0;
    for (const key of keys) {
      const value = await client.get(key);
      if (value) {
        totalPendingClicks += parseInt(value, 10);
      }
    }

    return {
      isRunning: this.isRunning,
      pendingUsers: keys.length,
      totalPendingClicks,
    };
  }
}
