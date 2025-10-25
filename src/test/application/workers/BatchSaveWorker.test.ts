import { BatchSaveWorker } from '../../../application/workers/BatchSaveWorker';
import type { PrismaClient } from '../../../generated/prisma';
import { redisClient } from '../../../infrastructure/redis/client';
import { REDIS_KEYS } from '../../../shared/constants';

jest.mock('../../../generated/prisma');

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
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      worker.start();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting with interval'),
        expect.any(Number),
        'ms',
      );

      consoleLogSpy.mockRestore();
    });

    it('should not start twice', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      worker.start();
      worker.start();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Already running'));

      consoleLogSpy.mockRestore();
    });

    it('should stop the worker', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      worker.start();
      await worker.stop();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Stopped'));

      consoleLogSpy.mockRestore();
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
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await worker.stop();

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Processing'),
        expect.anything(),
        expect.stringContaining('users with pending clicks'),
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '100');

      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Database error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      worker.start();
      await new Promise((resolve) => setTimeout(resolve, 100));
      await worker.stop();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing batch'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
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

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await worker.forceSave();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Force saving all pending data'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Force save completed'));

      consoleLogSpy.mockRestore();
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

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await worker.forceSave();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
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

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await worker.forceSave();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Batch processed in \d+ms/),
      );

      consoleLogSpy.mockRestore();
    });

    it('should report number of users processed', async () => {
      const client = redisClient.getClient();
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-1`, '50');
      await client.set(`${REDIS_KEYS.CLICK_PENDING}user-2`, '75');

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: { update: jest.fn() },
          click: { create: jest.fn() },
        });
      });

      await worker.forceSave();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing 2 users with pending clicks'),
      );

      consoleLogSpy.mockRestore();
    });
  });
});
