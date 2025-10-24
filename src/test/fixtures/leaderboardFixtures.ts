import { LeaderboardEntry } from '../../domain/value-objects/LeaderboardEntry';

export function createLeaderboardEntry(
  overrides: Partial<{
    userId: string;
    username: string;
    score: number;
    rank: number;
    previousRank: number;
  }> = {},
): LeaderboardEntry {
  return new LeaderboardEntry({
    userId: overrides.userId ?? 'test-user-1',
    username: overrides.username ?? 'testuser',
    score: overrides.score ?? 1000,
    rank: overrides.rank ?? 1,
    previousRank: overrides.previousRank,
  });
}

export function createLeaderboard(size: number): LeaderboardEntry[] {
  return Array.from(
    { length: size },
    (_, i) =>
      new LeaderboardEntry({
        userId: `user-${i + 1}`,
        username: `player${i + 1}`,
        score: (size - i) * 1000,
        rank: i + 1,
      }),
  );
}

export function createRedisLeaderboardData(size: number): Array<{ member: string; score: number }> {
  return Array.from({ length: size }, (_, i) => ({
    member: `user-${i + 1}`,
    score: (size - i) * 1000,
  }));
}

export const SAMPLE_LEADERBOARD = createLeaderboard(10);

export const SAMPLE_TOP3 = [
  createLeaderboardEntry({
    userId: 'champion-id',
    username: 'champion',
    score: 100000,
    rank: 1,
  }),
  createLeaderboardEntry({
    userId: 'second-id',
    username: 'runner_up',
    score: 75000,
    rank: 2,
  }),
  createLeaderboardEntry({
    userId: 'third-id',
    username: 'bronze',
    score: 50000,
    rank: 3,
  }),
];
