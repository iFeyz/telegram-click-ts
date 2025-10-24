import { Click } from '../../domain/value-objects/Click';

export function createTestClick(
  overrides: Partial<{
    userId: string;
    count: number;
    timestamp: Date;
  }> = {},
): Click {
  return new Click({
    userId: overrides.userId ?? 'test-user-1',
    count: overrides.count ?? 1,
    timestamp: overrides.timestamp,
  });
}

export function createClickBatch(userId: string, counts: number[]): Click[] {
  return Click.createBatch(userId, counts);
}

export function createTestClicks(userId: string, count: number, clickValue = 1): Click[] {
  return Array.from({ length: count }, () => createTestClick({ userId, count: clickValue }));
}

export function createMultiUserClicks(): Click[] {
  return [
    createTestClick({ userId: 'user-1', count: 10 }),
    createTestClick({ userId: 'user-1', count: 5 }),
    createTestClick({ userId: 'user-2', count: 20 }),
    createTestClick({ userId: 'user-2', count: 15 }),
    createTestClick({ userId: 'user-3', count: 30 }),
  ];
}

export function createOldClick(userId = 'test-user-1', ageMs = 10000): Click {
  return new Click({
    userId,
    count: 1,
    timestamp: new Date(Date.now() - ageMs),
  });
}

export function createRecentClick(userId = 'test-user-1'): Click {
  return new Click({
    userId,
    count: 1,
    timestamp: new Date(),
  });
}

export const SAMPLE_CLICKS = {
  single: createTestClick({ userId: 'alice-id', count: 1 }),
  batch: createClickBatch('bob-id', [10, 20, 30]),
  maxBatch: createTestClick({ userId: 'charlie-id', count: 100 }),
  multiUser: createMultiUserClicks(),
  old: createOldClick('dave-id', 60000),
  recent: createRecentClick('eve-id'),
};

export const INVALID_CLICK_DATA = {
  zero: { userId: 'test-user', count: 0 },
  negative: { userId: 'test-user', count: -5 },
  tooLarge: { userId: 'test-user', count: 101 },
  decimal: { userId: 'test-user', count: 5.5 },
};
