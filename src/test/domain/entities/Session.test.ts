import { Session } from '../../../domain/entities/Session';
import { InvalidClickError } from '../../../shared/errors';
import {
  createTestSession,
  createExpiredSession,
  createActiveSession,
  SAMPLE_SESSIONS,
} from '../../../test/fixtures/sessionFixtures';
import { createTimeHelper } from '../../../test/helpers/timeHelper';

describe('Session Entity', () => {
  const timeHelper = createTimeHelper();

  afterEach(() => {
    timeHelper.reset();
  });

  describe('constructor', () => {
    it('should create session with required fields', () => {
      const session = new Session({
        userId: 'user-1',
        telegramId: BigInt(123456),
      });

      expect(session.userId).toBe('user-1');
      expect(session.telegramId).toBe(BigInt(123456));
      expect(session.isActive).toBe(true);
      expect(session.clickCount).toBe(0);
    });

    it('should generate unique ID if not provided', () => {
      const session1 = new Session({ userId: 'user-1', telegramId: BigInt(123) });
      const session2 = new Session({ userId: 'user-1', telegramId: BigInt(123) });

      expect(session1.id).toBeDefined();
      expect(session2.id).toBeDefined();
      expect(session1.id).not.toBe(session2.id);
    });

    it('should generate unique token if not provided', () => {
      const session1 = new Session({ userId: 'user-1', telegramId: BigInt(123) });
      const session2 = new Session({ userId: 'user-1', telegramId: BigInt(123) });

      expect(session1.token).toBeDefined();
      expect(session2.token).toBeDefined();
      expect(session1.token).not.toBe(session2.token);
    });

    it('should use provided token', () => {
      const session = new Session({
        userId: 'user-1',
        telegramId: BigInt(123),
        token: 'custom-token',
      });

      expect(session.token).toBe('custom-token');
    });

    it('should set default TTL to 1 hour', () => {
      const now = Date.now();
      const session = new Session({ userId: 'user-1', telegramId: BigInt(123) });

      const expectedExpiry = now + 3600000;
      const actualExpiry = session.expiresAt.getTime();

      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 100);
      expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 100);
    });

    it('should use custom TTL if provided', () => {
      const ttlMs = 7200000;
      const now = Date.now();
      const session = new Session({
        userId: 'user-1',
        telegramId: BigInt(123),
        ttlMs,
      });

      const expectedExpiry = now + ttlMs;
      const actualExpiry = session.expiresAt.getTime();

      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 100);
      expect(actualExpiry).toBeLessThanOrEqual(expectedExpiry + 100);
    });
  });

  describe('isExpired', () => {
    it('should return false for active session', () => {
      const session = SAMPLE_SESSIONS.active;
      expect(session.isExpired()).toBe(false);
    });

    it('should return true for expired session', () => {
      const session = SAMPLE_SESSIONS.expired;
      expect(session.isExpired()).toBe(true);
    });

    it('should return false for near-expiry session', () => {
      const session = SAMPLE_SESSIONS.nearExpiry;
      expect(session.isExpired()).toBe(false);
    });

    it('should handle exact expiry time', () => {
      const now = Date.now();
      const session = new Session({
        userId: 'user-1',
        telegramId: BigInt(123),
        expiresAt: new Date(now - 1000),
      });

      expect(session.isExpired()).toBe(true);
    });
  });

  describe('needsRefresh', () => {
    it('should return false if more than 5 minutes until expiry', () => {
      const session = new Session({
        userId: 'user-1',
        telegramId: BigInt(123),
        ttlMs: 600000,
      });

      expect(session.needsRefresh()).toBe(false);
    });

    it('should return true if less than 5 minutes until expiry', () => {
      const session = new Session({
        userId: 'user-1',
        telegramId: BigInt(123),
        ttlMs: 240000,
      });

      expect(session.needsRefresh()).toBe(true);
    });

    it('should return true for near-expiry session', () => {
      const session = SAMPLE_SESSIONS.nearExpiry;
      expect(session.needsRefresh()).toBe(true);
    });

    it('should return true for expired session', () => {
      const session = SAMPLE_SESSIONS.expired;
      expect(session.needsRefresh()).toBe(true);
    });
  });

  describe('touch', () => {
    it('should update lastActivity timestamp', () => {
      const session = createActiveSession();
      const oldActivity = session.lastActivity;

      setTimeout(() => {
        session.touch();
        expect(session.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      }, 10);
    });
  });

  describe('addClicks', () => {
    it('should increment click count', () => {
      const session = createActiveSession();
      session.addClicks(5);
      expect(session.clickCount).toBe(5);
    });

    it('should accumulate clicks', () => {
      const session = createActiveSession();
      session.addClicks(5);
      session.addClicks(10);
      expect(session.clickCount).toBe(15);
    });

    it('should update lastActivity', () => {
      const session = createActiveSession();
      const oldActivity = session.lastActivity;

      setTimeout(() => {
        session.addClicks(1);
        expect(session.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      }, 10);
    });

    it('should throw error for negative clicks', () => {
      const session = createActiveSession();
      expect(() => session.addClicks(-5)).toThrow(InvalidClickError);
      expect(() => session.addClicks(-5)).toThrow('Click count cannot be negative');
    });

    it('should not modify clickCount on error', () => {
      const session = createActiveSession();
      session.addClicks(10);

      try {
        session.addClicks(-5);
      } catch (error) {
        expect(session.clickCount).toBe(10);
      }
    });

    it('should handle zero clicks', () => {
      const session = createActiveSession();
      session.addClicks(0);
      expect(session.clickCount).toBe(0);
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', () => {
      const session = createActiveSession();
      expect(session.isActive).toBe(true);

      session.deactivate();
      expect(session.isActive).toBe(false);
    });

    it('should work on already inactive session', () => {
      const session = SAMPLE_SESSIONS.inactive;
      expect(session.isActive).toBe(false);

      session.deactivate();
      expect(session.isActive).toBe(false);
    });
  });

  describe('extend', () => {
    it('should extend expiry time', () => {
      const session = createActiveSession();
      const originalExpiry = session.expiresAt.getTime();

      const extensionMs = 3600000;
      session.extend(extensionMs);

      const newExpiry = session.expiresAt.getTime();
      expect(newExpiry).toBeGreaterThan(originalExpiry - 1000);
    });

    it('should update lastActivity', () => {
      const session = createActiveSession();
      const oldActivity = session.lastActivity;

      setTimeout(() => {
        session.extend(3600000);
        expect(session.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      }, 10);
    });

    it('should work on expired session', () => {
      timeHelper.freeze();
      const session = createExpiredSession();

      expect(session.isExpired()).toBe(true);

      session.extend(3600000);
      expect(session.isExpired()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize session correctly', () => {
      const session = createTestSession({
        id: 'session-1',
        userId: 'user-1',
        telegramId: BigInt(123456),
        token: 'test-token',
        username: 'testuser',
        isActive: true,
        clickCount: 50,
      });

      const json = session.toJSON();

      expect(json.id).toBe('session-1');
      expect(json.userId).toBe('user-1');
      expect(json.telegramId).toBe('123456');
      expect(json.token).toBe('test-token');
      expect(json.username).toBe('testuser');
      expect(json.isActive).toBe(true);
      expect(json.clickCount).toBe(50);
      expect(typeof json.createdAt).toBe('string');
      expect(typeof json.lastActivity).toBe('string');
      expect(typeof json.expiresAt).toBe('string');
    });

    it('should convert BigInt to string', () => {
      const session = createTestSession({
        userId: 'user-1',
        telegramId: BigInt(999999999999),
      });

      const json = session.toJSON();
      expect(json.telegramId).toBe('999999999999');
    });
  });

  describe('readonly fields', () => {
    it('should have readonly id field', () => {
      const session = createActiveSession();
      const descriptor = Object.getOwnPropertyDescriptor(session, 'id');
      expect(descriptor?.writable).toBeDefined();
    });
  });

  describe('session lifecycle', () => {
    it('should handle complete session lifecycle', () => {
      const session = createActiveSession();

      expect(session.isActive).toBe(true);
      expect(session.isExpired()).toBe(false);

      session.addClicks(10);
      expect(session.clickCount).toBe(10);

      session.addClicks(5);
      expect(session.clickCount).toBe(15);

      expect(session.needsRefresh()).toBe(false);

      session.deactivate();
      expect(session.isActive).toBe(false);
    });
  });
});
