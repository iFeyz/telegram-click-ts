import { BatchSaveWorker } from '../../../application/workers/BatchSaveWorker';
import type { PrismaClient } from '../../../generated/prisma';
import { redisClient } from '../../../infrastructure/redis/client';
import { REDIS_KEYS } from '../../../shared/constants';
import { logger } from '../../../infrastructure/observability/logger';

jest.mock('../../../generated/prisma');

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  },
}));

describe('BatchSaveWorker', () => {
  let worker: BatchSaveWorker;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeAll(async () => {
    await redisClient.getClient().flushdb();
  });

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn(),
      user: {
        update: jest.fn(),
      } as any,
      click: {
        create: jest.fn(),
      } as any,
    } as any;

    worker = new BatchSaveWorker(mockPrisma, redisClient);
    await redisClient.getClient().flushdb();
  });

  afterEach(async () => {
    await worker.stop();
    await redisClient.getClient().flushdb();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  describe('start and stop', () => {
    it('should start the worker', () => {
      worker.start();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'BatchSaveWorker starting',
          intervalMs: expect.any(Number),
        }),
      );
    });

    it('should not start twice', () => {
      worker.start();
      worker.start();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'BatchSaveWorker already running',
        }),
      );
    });

    it('should stop the worker', async () => {
      worker.start();
      await worker.stop();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'BatchSaveWorker stopped',
        }),
      );
    });

    it('should do nothing when stopping if not running', async () => {
      await expect(worker.stop()).resolves.not.toThrow();
    });
  });

  describe('processBatch', () => {
    it('should process pending clicks and save to database', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '50');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        };
        return await callback(mockTx);
      });

      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await worker.stop();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should not process if no pending clicks exist', async () => {
      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await worker.stop();

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Processing'),
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');

      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Database error'));

      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await worker.stop();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error processing batch',
        }),
      );
    });

    it('should rollback clicks to Redis on database failure', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');

      mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB error'));

      try {
        await worker.forceSave();
      } catch (error) {
        // Expected to throw
      }

      const rollbackValue = await client.get(`${REDIS_KEYS.CLICK_PENDING}user-1`);
      expect(rollbackValue).toBe('100');
    });
  });

  describe('processBatchKeys', () => {
    it('should update user scores in database', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '250');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '150');

      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        click: { create: jest.fn().mockResolvedValue({}) },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockTx);
      });

      await worker.forceSave();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should create click records in database', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '75');

      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        click: { create: jest.fn().mockResolvedValue({}) },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockTx);
      });

      await worker.forceSave();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should delete Redis keys after successful save', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');

      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        click: { create: jest.fn().mockResolvedValue({}) },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockTx);
      });

      await worker.forceSave();

      const value = await client.get(`${REDIS_KEYS.CLICK_PENDING}user-1`);
      expect(value).toBeNull();
    });

    it('should skip keys with zero or negative values', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '0');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '-10');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({ user: { update: jest.fn() }, click: { create: jest.fn() } });
      });

      await worker.forceSave();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle large batches by chunking', async () => {
      const client = redisClient.getClient();

      for (let i = 0; i < 150; i++) {
        await client.set(`${REDIS_KEYS.CLICK_PENDING}user-${i}`, '10');
      }

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          user: { update: jest.fn().mockResolvedValue({}) },
          click: { create: jest.fn().mockResolvedValue({}) },
        };
        return await callback(mockTx);
      });

      await worker.forceSave();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('forceSave', () => {
    it('should immediately process all pending clicks', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '50');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await worker.forceSave();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Force saving all pending data',
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Force save completed',
        }),
      );
    });

    it('should work even when worker is not running', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '25');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await worker.forceSave();

      const value = await client.get(`${REDIS_KEYS.CLICK_PENDING}user-1`);
      expect(value).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return worker statistics', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '200');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-3`, '300');

      const stats = await worker.getStats();

      expect(stats).toEqual({
        isRunning: false,
        pendingUsers: 3,
        totalPendingClicks: 600,
      });
    });

    it('should show running status when started', async () => {
      worker.start();

      const stats = await worker.getStats();

      expect(stats.isRunning).toBe(true);

      await worker.stop();
    });

    it('should return zero stats when no pending clicks', async () => {
      const stats = await worker.getStats();

      expect(stats).toEqual({
        isRunning: false,
        pendingUsers: 0,
        totalPendingClicks: 0,
      });
    });

    it('should calculate total pending clicks correctly', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '50');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '75');

      const stats = await worker.getStats();

      expect(stats.totalPendingClicks).toBe(125);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete save cycle', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');

      const mockTx = {
        user: {
          update: jest.fn().mockResolvedValue({ id: 'user-1', score: 100 }),
        },
        click: {
          create: jest.fn().mockResolvedValue({ id: '1', userId: 'user-1', count: 100 }),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(mockTx);
      });

      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await worker.stop();

      const remaining = await client.get(`${REDIS_KEYS.CLICK_PENDING}user-1`);
      expect(remaining).toBeNull();
    });

    it('should handle rapid start/stop cycles', async () => {
      worker.start();
      await worker.stop();
      worker.start();
      await worker.stop();

      const stats = await worker.getStats();
      expect(stats.isRunning).toBe(false);
    });

    it('should process multiple batches over time', async () => {
      const client = redisClient.getClient();

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      worker.start();

      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '50');
      await new Promise((resolve) => setTimeout(resolve, 100));

      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '75');
      await new Promise((resolve) => setTimeout(resolve, 100));

      await worker.stop();

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle malformed Redis values', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, 'invalid');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await expect(worker.forceSave()).resolves.not.toThrow();
    });

    it('should handle empty user ID', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}`, '100');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await expect(worker.forceSave()).resolves.not.toThrow();
    });

    it('should handle partial transaction failures', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '200');

      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Transaction failed'));

      await worker.forceSave();

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle concurrent force saves', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await Promise.all([worker.forceSave(), worker.forceSave()]);

      await expect(worker.getStats()).resolves.toMatchObject({
        pendingUsers: 0,
      });
    });
  });

  describe('performance', () => {
    it('should log batch processing time', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await worker.forceSave();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Batch processed',
          durationMs: expect.any(Number),
        }),
      );
    });

    it('should report number of users processed', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '50');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '75');

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await worker.forceSave();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Processing users with pending clicks',
          userCount: 2,
        }),
      );
    });
  });
});
