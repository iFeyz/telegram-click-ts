import { SessionRedisRepository } from '../../../infrastructure/redis/repositories/sessionRepository';
import { InvalidSessionError } from '../../../shared/errors';
import type { SessionData } from '../../../domain/repositories/ISessionRepository';
import { redisClient } from '../../../infrastructure/redis/client';

describe('SessionRedisRepository', () => {
  let repository: SessionRedisRepository;

  beforeEach(async () => {
    repository = new SessionRedisRepository();
    await redisClient.getClient().flushdb();
  });

  afterEach(async () => {
    await redisClient.getClient().flushdb();
  });

  describe('setSession', () => {
    it('should store session with TTL', async () => {
      const token = 'test-token';
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123456',
        lastActivity: new Date('2025-10-25T10:00:00Z'),
        clickCount: 5,
      };

      await repository.setSession(token, data);

      const session = await repository.getSession(token);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('user-1');
      expect(session?.clickCount).toBe(5);
    });

    it('should serialize date as ISO string', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123456',
        lastActivity: new Date('2025-10-25T10:00:00Z'),
        clickCount: 5,
      };

      await repository.setSession('token', data);
      const session = await repository.getSession('token');

      expect(session?.lastActivity).toBeInstanceOf(Date);
      expect(session?.lastActivity.toISOString()).toBe('2025-10-25T10:00:00.000Z');
    });

    it('should update existing session', async () => {
      const token = 'update-token';
      const initialData: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date('2025-10-25T10:00:00Z'),
        clickCount: 5,
      };

      await repository.setSession(token, initialData);

      const updatedData: SessionData = {
        ...initialData,
        clickCount: 10,
        lastActivity: new Date('2025-10-25T11:00:00Z'),
      };

      await repository.setSession(token, updatedData);

      const session = await repository.getSession(token);
      expect(session?.clickCount).toBe(10);
      expect(session?.lastActivity.toISOString()).toBe('2025-10-25T11:00:00.000Z');
    });
  });

  describe('getSession', () => {
    it('should retrieve stored session', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123456',
        lastActivity: new Date('2025-10-25T10:00:00Z'),
        clickCount: 5,
      };

      await repository.setSession('token', data);
      const retrieved = await repository.getSession('token');

      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe('user-1');
      expect(retrieved?.clickCount).toBe(5);
      expect(retrieved?.lastActivity).toBeInstanceOf(Date);
    });

    it('should return null for non-existent session', async () => {
      const session = await repository.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should parse lastActivity as Date object', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date('2025-10-25T10:00:00Z'),
        clickCount: 0,
      };

      await repository.setSession('token', data);
      const retrieved = await repository.getSession('token');

      expect(retrieved?.lastActivity).toBeInstanceOf(Date);
      expect(retrieved?.lastActivity.toISOString()).toBe('2025-10-25T10:00:00.000Z');
    });
  });

  describe('touchSession', () => {
    it('should update session lastActivity', async () => {
      const oldDate = new Date(Date.now() - 10000);
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: oldDate,
        clickCount: 0,
      };

      await repository.setSession('token', data);

      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await repository.touchSession('token');
      expect(result).toBe(true);

      const updated = await repository.getSession('token');
      expect(updated?.lastActivity.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should return false for non-existent session', async () => {
      const result = await repository.touchSession('non-existent');
      expect(result).toBe(false);
    });

    it('should preserve other session data', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date('2025-10-25T10:00:00Z'),
        clickCount: 42,
      };

      await repository.setSession('token', data);
      await repository.touchSession('token');

      const updated = await repository.getSession('token');
      expect(updated?.userId).toBe('user-1');
      expect(updated?.clickCount).toBe(42);
    });
  });

  describe('deleteSession', () => {
    it('should remove session', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token', data);
      expect(await repository.sessionExists('token')).toBe(true);

      await repository.deleteSession('token');
      expect(await repository.sessionExists('token')).toBe(false);
    });

    it('should not throw for non-existent session', async () => {
      await expect(repository.deleteSession('non-existent')).resolves.not.toThrow();
    });
  });

  describe('sessionExists', () => {
    it('should return true for existing session', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token', data);
      const exists = await repository.sessionExists('token');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const exists = await repository.sessionExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should return all sessions for a user', async () => {
      const data1: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      const data2: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token-1', data1);
      await repository.setSession('token-2', data2);

      const sessions = await repository.getUserSessions('user-1');

      expect(sessions).toHaveLength(2);
      expect(sessions).toContain('token-1');
      expect(sessions).toContain('token-2');
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await repository.getUserSessions('non-existent');
      expect(sessions).toEqual([]);
    });

    it('should not return sessions of other users', async () => {
      const data1: SessionData = {
        userId: 'user-1',
        telegramId: '111',
        lastActivity: new Date(),
        clickCount: 0,
      };

      const data2: SessionData = {
        userId: 'user-2',
        telegramId: '222',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token-1', data1);
      await repository.setSession('token-2', data2);

      const sessions = await repository.getUserSessions('user-1');

      expect(sessions).toHaveLength(1);
      expect(sessions).toContain('token-1');
      expect(sessions).not.toContain('token-2');
    });
  });

  describe('clearUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token-1', data);
      await repository.setSession('token-2', data);

      await repository.clearUserSessions('user-1');

      const sessions = await repository.getUserSessions('user-1');
      expect(sessions).toEqual([]);
    });

    it('should not affect other users sessions', async () => {
      const data1: SessionData = {
        userId: 'user-1',
        telegramId: '111',
        lastActivity: new Date(),
        clickCount: 0,
      };

      const data2: SessionData = {
        userId: 'user-2',
        telegramId: '222',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token-1', data1);
      await repository.setSession('token-2', data2);

      await repository.clearUserSessions('user-1');

      expect(await repository.sessionExists('token-1')).toBe(false);
      expect(await repository.sessionExists('token-2')).toBe(true);
    });

    it('should not throw for user with no sessions', async () => {
      await expect(repository.clearUserSessions('non-existent')).resolves.not.toThrow();
    });
  });

  describe('incrementClickCount', () => {
    it('should increment click count', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date('2025-10-25T10:00:00Z'),
        clickCount: 5,
      };

      await repository.setSession('token', data);

      const newCount = await repository.incrementClickCount('token', 3);

      expect(newCount).toBe(8);

      const session = await repository.getSession('token');
      expect(session?.clickCount).toBe(8);
    });

    it('should update lastActivity when incrementing', async () => {
      const oldDate = new Date(Date.now() - 10000);
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: oldDate,
        clickCount: 0,
      };

      await repository.setSession('token', data);

      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.incrementClickCount('token', 1);

      const session = await repository.getSession('token');
      expect(session?.lastActivity.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should throw InvalidSessionError for non-existent session', async () => {
      await expect(repository.incrementClickCount('non-existent', 1)).rejects.toThrow(
        InvalidSessionError,
      );
    });
  });

  describe('getActiveSessionsCount', () => {
    it('should return count of active sessions', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token-1', data);
      await repository.setSession('token-2', data);
      await repository.setSession('token-3', data);

      const count = await repository.getActiveSessionsCount();
      expect(count).toBe(3);
    });

    it('should return 0 when no sessions exist', async () => {
      const count = await repository.getActiveSessionsCount();
      expect(count).toBe(0);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should return count of cleaned sessions', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token-1', data);

      const cleaned = await repository.cleanupExpiredSessions();
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty Redis gracefully', async () => {
      const cleaned = await repository.cleanupExpiredSessions();
      expect(cleaned).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle session with zero clicks', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token', data);
      const session = await repository.getSession('token');

      expect(session?.clickCount).toBe(0);
    });

    it('should handle very large telegramId', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '9999999999999999999',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token', data);
      const session = await repository.getSession('token');

      expect(session?.telegramId).toBeDefined();
    });

    it('should handle multiple sessions for same user', async () => {
      const data: SessionData = {
        userId: 'user-1',
        telegramId: '123',
        lastActivity: new Date(),
        clickCount: 0,
      };

      await repository.setSession('token-1', data);
      await repository.setSession('token-2', data);
      await repository.setSession('token-3', data);

      const sessions = await repository.getUserSessions('user-1');
      expect(sessions.length).toBe(3);
    });
  });
});
