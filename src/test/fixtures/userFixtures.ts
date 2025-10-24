import { User } from '../../domain/entities/User';

export function createTestUser(
  overrides: Partial<{
    id: string;
    telegramId: bigint;
    username: string;
    firstName: string;
    lastName: string;
    customName: string;
    score: bigint;
  }> = {},
): User {
  return new User({
    id: overrides.id ?? 'test-user-1',
    telegramId: overrides.telegramId ?? BigInt(123456789),
    username: overrides.username ?? 'testuser',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    customName: overrides.customName,
    score: overrides.score ?? BigInt(0),
  });
}

export function createTestUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) =>
    createTestUser({
      id: `test-user-${i + 1}`,
      telegramId: BigInt(100000 + i),
      username: `user${i + 1}`,
      firstName: `User`,
      lastName: `${i + 1}`,
      score: BigInt(Math.floor(Math.random() * 10000)),
    }),
  );
}

export function createLeaderboardUsers(count: number): User[] {
  return Array.from({ length: count }, (_, i) =>
    createTestUser({
      id: `leader-${i + 1}`,
      telegramId: BigInt(200000 + i),
      username: `leader${i + 1}`,
      firstName: `Leader`,
      lastName: `${i + 1}`,
      score: BigInt((count - i) * 1000),
    }),
  ).sort((a, b) => Number(b.score - a.score));
}

export const SAMPLE_USERS = {
  alice: new User({
    id: 'alice-id',
    telegramId: BigInt(111111),
    username: 'alice',
    firstName: 'Alice',
    lastName: 'Smith',
    score: BigInt(5000),
  }),
  bob: new User({
    id: 'bob-id',
    telegramId: BigInt(222222),
    username: 'bob',
    firstName: 'Bob',
    lastName: 'Jones',
    score: BigInt(3000),
  }),
  charlie: new User({
    id: 'charlie-id',
    telegramId: BigInt(333333),
    firstName: 'Charlie',
    score: BigInt(1000),
  }),
  noUsername: new User({
    id: 'no-username-id',
    telegramId: BigInt(444444),
    firstName: 'NoUsername',
    score: BigInt(500),
  }),
  customName: new User({
    id: 'custom-name-id',
    telegramId: BigInt(555555),
    username: 'oldusername',
    firstName: 'Old',
    customName: 'ProGamer123',
    score: BigInt(9999),
  }),
};
