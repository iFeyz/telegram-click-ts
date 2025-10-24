import { ClickRedisRepository } from '../../../infrastructure/redis/repositories/clickRepository';
import { redisClient } from '../../../infrastructure/redis/client';

describe('ClickRedisRepository', () => {
  let repository: ClickRedisRepository;

  beforeEach(async () => {
    repository = new ClickRedisRepository();
    await redisClient.getClient().flushdb();
  });

  afterEach(async () => {
    await redisClient.getClient().flushdb();
  });

  describe('incrementClickCount', () => {
    it('should increment click count for user', async () => {
      const count = await repository.incrementClickCount('user-1', 5);
      expect(count).toBe(5);
    });

    it('should accumulate multiple increments', async () => {
      await repository.incrementClickCount('user-1', 5);
      await repository.incrementClickCount('user-1', 3);
      const count = await repository.incrementClickCount('user-1', 2);

      expect(count).toBe(10);
    });

    it('should maintain separate counts per user', async () => {
      await repository.incrementClickCount('user-1', 5);
      await repository.incrementClickCount('user-2', 3);

      const count1 = await repository.getPendingClicks('user-1');
      const count2 = await repository.getPendingClicks('user-2');

      expect(count1).toBe(5);
      expect(count2).toBe(3);
    });

    it('should handle single click increment', async () => {
      const count = await repository.incrementClickCount('user-1', 1);
      expect(count).toBe(1);
    });

    it('should handle large increments', async () => {
      const count = await repository.incrementClickCount('user-1', 100);
      expect(count).toBe(100);
    });
  });

  describe('getPendingClicks', () => {
    it('should return pending click count', async () => {
      await repository.incrementClickCount('user-1', 10);
      const count = await repository.getPendingClicks('user-1');

      expect(count).toBe(10);
    });

    it('should return 0 for user with no pending clicks', async () => {
      const count = await repository.getPendingClicks('non-existent');
      expect(count).toBe(0);
    });

    it('should return correct count after multiple increments', async () => {
      await repository.incrementClickCount('user-1', 5);
      await repository.incrementClickCount('user-1', 7);
      await repository.incrementClickCount('user-1', 3);

      const count = await repository.getPendingClicks('user-1');
      expect(count).toBe(15);
    });
  });

  describe('getAllPendingClicks', () => {
    it('should return all pending clicks', async () => {
      await repository.incrementClickCount('user-1', 10);
      await repository.incrementClickCount('user-2', 20);
      await repository.incrementClickCount('user-3', 30);

      const allPending = await repository.getAllPendingClicks();

      expect(allPending.size).toBe(3);
      expect(allPending.get('user-1')).toBe(10);
      expect(allPending.get('user-2')).toBe(20);
      expect(allPending.get('user-3')).toBe(30);
    });

    it('should return empty Map when no pending clicks', async () => {
      const allPending = await repository.getAllPendingClicks();

      expect(allPending).toBeInstanceOf(Map);
      expect(allPending.size).toBe(0);
    });

    it('should handle single user', async () => {
      await repository.incrementClickCount('user-1', 42);

      const allPending = await repository.getAllPendingClicks();

      expect(allPending.size).toBe(1);
      expect(allPending.get('user-1')).toBe(42);
    });
  });

  describe('clearPendingClicks', () => {
    it('should clear pending clicks for specified users', async () => {
      await repository.incrementClickCount('user-1', 10);
      await repository.incrementClickCount('user-2', 20);

      await repository.clearPendingClicks(['user-1', 'user-2']);

      const count1 = await repository.getPendingClicks('user-1');
      const count2 = await repository.getPendingClicks('user-2');

      expect(count1).toBe(0);
      expect(count2).toBe(0);
    });

    it('should only clear specified users', async () => {
      await repository.incrementClickCount('user-1', 10);
      await repository.incrementClickCount('user-2', 20);
      await repository.incrementClickCount('user-3', 30);

      await repository.clearPendingClicks(['user-1', 'user-2']);

      const count3 = await repository.getPendingClicks('user-3');
      expect(count3).toBe(30);
    });

    it('should handle empty array', async () => {
      await repository.incrementClickCount('user-1', 10);
      await repository.clearPendingClicks([]);

      const count = await repository.getPendingClicks('user-1');
      expect(count).toBe(10);
    });

    it('should not throw for non-existent users', async () => {
      await expect(repository.clearPendingClicks(['non-existent'])).resolves.not.toThrow();
    });

    it('should clear single user', async () => {
      await repository.incrementClickCount('user-1', 10);
      await repository.clearPendingClicks(['user-1']);

      const count = await repository.getPendingClicks('user-1');
      expect(count).toBe(0);
    });
  });

  describe('addClickEvent', () => {
    it('should add click event to stream', async () => {
      const id = await repository.addClickEvent('user-1', 5);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should add multiple events', async () => {
      const id1 = await repository.addClickEvent('user-1', 5);
      const id2 = await repository.addClickEvent('user-2', 10);

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should store event data correctly', async () => {
      await repository.addClickEvent('user-1', 42);

      const events = await repository.readClickEvents('0', 10);

      expect(events.length).toBeGreaterThan(0);
      const event = events.find((e) => e.userId === 'user-1');
      expect(event).toBeDefined();
      expect(event?.count).toBe(42);
    });
  });

  describe('readClickEvents', () => {
    it('should read click events from stream', async () => {
      await repository.addClickEvent('user-1', 5);
      await repository.addClickEvent('user-2', 10);

      const events = await repository.readClickEvents('0', 10);

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0]).toHaveProperty('id');
      expect(events[0]).toHaveProperty('userId');
      expect(events[0]).toHaveProperty('count');
      expect(events[0]).toHaveProperty('timestamp');
    });

    it('should return empty array when no events', async () => {
      const events = await repository.readClickEvents('0', 10);

      expect(events).toEqual([]);
    });

    it('should limit number of events returned', async () => {
      for (let i = 0; i < 10; i++) {
        await repository.addClickEvent(`user-${i}`, i);
      }

      const events = await repository.readClickEvents('0', 5);

      expect(events.length).toBeLessThanOrEqual(5);
    });

    it('should include timestamp in events', async () => {
      const beforeTime = Date.now();
      await repository.addClickEvent('user-1', 5);
      const afterTime = Date.now();

      const events = await repository.readClickEvents('0', 10);

      const event = events.find((e) => e.userId === 'user-1');
      expect(event?.timestamp).toBeGreaterThanOrEqual(beforeTime - 1000);
      expect(event?.timestamp).toBeLessThanOrEqual(afterTime + 1000);
    });

    it('should parse count as number', async () => {
      await repository.addClickEvent('user-1', 42);

      const events = await repository.readClickEvents('0', 10);

      const event = events.find((e) => e.userId === 'user-1');
      expect(typeof event?.count).toBe('number');
      expect(event?.count).toBe(42);
    });
  });

  describe('batch processing workflow', () => {
    it('should support complete batch save workflow', async () => {
      await repository.incrementClickCount('user-1', 10);
      await repository.incrementClickCount('user-2', 20);
      await repository.incrementClickCount('user-3', 30);

      const allPending = await repository.getAllPendingClicks();
      expect(allPending.size).toBe(3);

      const userIds = Array.from(allPending.keys());
      await repository.clearPendingClicks(userIds);

      const afterClear = await repository.getAllPendingClicks();
      expect(afterClear.size).toBe(0);
    });

    it('should handle partial batch clear', async () => {
      await repository.incrementClickCount('user-1', 10);
      await repository.incrementClickCount('user-2', 20);
      await repository.incrementClickCount('user-3', 30);

      await repository.clearPendingClicks(['user-1']);

      const remaining = await repository.getAllPendingClicks();
      expect(remaining.size).toBe(2);
      expect(remaining.get('user-1')).toBeUndefined();
      expect(remaining.get('user-2')).toBe(20);
      expect(remaining.get('user-3')).toBe(30);
    });
  });

  describe('event sourcing workflow', () => {
    it('should support event sourcing pattern', async () => {
      await repository.addClickEvent('user-1', 5);
      await repository.addClickEvent('user-2', 10);

      const events = await repository.readClickEvents('0', 10);

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events.some((e) => e.userId === 'user-1' && e.count === 5)).toBe(true);
      expect(events.some((e) => e.userId === 'user-2' && e.count === 10)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero click increment', async () => {
      const count = await repository.incrementClickCount('user-1', 0);
      expect(count).toBe(0);
    });

    it('should handle very large click counts', async () => {
      const count = await repository.incrementClickCount('user-1', 999999);
      expect(count).toBe(999999);
    });

    it('should handle special characters in userId', async () => {
      const userId = 'user-with-dash_and_underscore';
      await repository.incrementClickCount(userId, 5);

      const count = await repository.getPendingClicks(userId);
      expect(count).toBe(5);
    });

    it('should handle rapid successive increments', async () => {
      const increments = [];
      for (let i = 0; i < 10; i++) {
        increments.push(repository.incrementClickCount('user-1', 1));
      }

      await Promise.all(increments);

      const count = await repository.getPendingClicks('user-1');
      expect(count).toBe(10);
    });

    it('should handle concurrent operations on different users', async () => {
      await Promise.all([
        repository.incrementClickCount('user-1', 10),
        repository.incrementClickCount('user-2', 20),
        repository.incrementClickCount('user-3', 30),
      ]);

      const allPending = await repository.getAllPendingClicks();
      expect(allPending.size).toBe(3);
    });
  });
});
