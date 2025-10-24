import { Session } from '../../domain/entities/Session';

export function createTestSession(
  overrides: Partial<{
    id: string;
    userId: string;
    telegramId: bigint;
    token: string;
    username: string;
    isActive: boolean;
    clickCount: number;
    lastActivity: Date;
    createdAt: Date;
    expiresAt: Date;
    ttlMs: number;
  }> = {},
): Session {
  return new Session({
    id: overrides.id,
    userId: overrides.userId ?? 'test-user-1',
    telegramId: overrides.telegramId ?? BigInt(123456789),
    token: overrides.token,
    username: overrides.username ?? 'testuser',
    isActive: overrides.isActive ?? true,
    clickCount: overrides.clickCount ?? 0,
    lastActivity: overrides.lastActivity,
    createdAt: overrides.createdAt,
    expiresAt: overrides.expiresAt,
    ttlMs: overrides.ttlMs,
  });
}

export function createExpiredSession(
  userId = 'test-user-1',
  telegramId = BigInt(123456789),
): Session {
  const now = new Date();
  return new Session({
    userId,
    telegramId,
    createdAt: new Date(now.getTime() - 7200000),
    expiresAt: new Date(now.getTime() - 1000),
    isActive: true,
  });
}

export function createNearExpirySession(
  userId = 'test-user-1',
  telegramId = BigInt(123456789),
): Session {
  const now = new Date();
  return new Session({
    userId,
    telegramId,
    createdAt: new Date(now.getTime() - 3300000),
    expiresAt: new Date(now.getTime() + 300000),
    isActive: true,
  });
}

export function createActiveSession(
  userId = 'test-user-1',
  telegramId = BigInt(123456789),
): Session {
  return new Session({
    userId,
    telegramId,
    isActive: true,
    ttlMs: 3600000,
  });
}

export function createInactiveSession(
  userId = 'test-user-1',
  telegramId = BigInt(123456789),
): Session {
  const session = createActiveSession(userId, telegramId);
  session.deactivate();
  return session;
}

export const SAMPLE_SESSIONS = {
  active: createActiveSession('alice-id', BigInt(111111)),
  expired: createExpiredSession('bob-id', BigInt(222222)),
  nearExpiry: createNearExpirySession('charlie-id', BigInt(333333)),
  inactive: createInactiveSession('dave-id', BigInt(444444)),
  withClicks: (() => {
    const session = createActiveSession('eve-id', BigInt(555555));
    session.addClicks(50);
    return session;
  })(),
};
