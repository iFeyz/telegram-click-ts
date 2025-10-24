import { LeaderboardRedisRepository } from '../../../infrastructure/redis/repositories/leaderboardRepository';
import { redisClient } from '../../../infrastructure/redis/client';

describe('LeaderboardRedisRepository', () => {
  let repository: LeaderboardRedisRepository;

  beforeEach(async () => {
    repository = new LeaderboardRedisRepository();
    await redisClient.getClient().flushdb();
  });

  afterEach(async () => {
    await redisClient.getClient().flushdb();
  });

  describe('updateScore', () => {
    it('should update user score', async () => {
      await repository.updateScore('user-1', 100);

      const score = await repository.getUserScore('user-1');
      expect(score).toBe(100);
    });

    it('should replace existing score', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-1', 200);

      const score = await repository.getUserScore('user-1');
      expect(score).toBe(200);
    });

    it('should handle multiple users', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.updateScore('user-3', 300);

      const score1 = await repository.getUserScore('user-1');
      const score2 = await repository.getUserScore('user-2');
      const score3 = await repository.getUserScore('user-3');

      expect(score1).toBe(100);
      expect(score2).toBe(200);
      expect(score3).toBe(300);
    });
  });

  describe('incrementScore', () => {
    it('should increment user score', async () => {
      await repository.updateScore('user-1', 100);

      const newScore = await repository.incrementScore('user-1', 50);

      expect(newScore).toBe(150);
    });

    it('should create score if not exists', async () => {
      const score = await repository.incrementScore('user-1', 100);

      expect(score).toBe(100);
    });

    it('should handle negative increments', async () => {
      await repository.updateScore('user-1', 100);

      const newScore = await repository.incrementScore('user-1', -30);

      expect(newScore).toBe(70);
    });

    it('should handle decimal scores', async () => {
      await repository.updateScore('user-1', 100);

      const newScore = await repository.incrementScore('user-1', 0.5);

      expect(newScore).toBe(100.5);
    });
  });

  describe('getUserRank', () => {
    it('should return user rank (1-indexed)', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.updateScore('user-3', 300);

      const rank1 = await repository.getUserRank('user-1');
      const rank2 = await repository.getUserRank('user-2');
      const rank3 = await repository.getUserRank('user-3');

      expect(rank3).toBe(1);
      expect(rank2).toBe(2);
      expect(rank1).toBe(3);
    });

    it('should return null for non-existent user', async () => {
      const rank = await repository.getUserRank('non-existent');
      expect(rank).toBeNull();
    });

    it('should update rank when score changes', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);

      const rankBefore = await repository.getUserRank('user-1');
      expect(rankBefore).toBe(2);

      await repository.updateScore('user-1', 300);

      const rankAfter = await repository.getUserRank('user-1');
      expect(rankAfter).toBe(1);
    });
  });

  describe('getUserScore', () => {
    it('should return user score', async () => {
      await repository.updateScore('user-1', 12345);

      const score = await repository.getUserScore('user-1');
      expect(score).toBe(12345);
    });

    it('should return 0 for non-existent user', async () => {
      const score = await repository.getUserScore('non-existent');
      expect(score).toBe(0);
    });
  });

  describe('getTop', () => {
    it('should return top N users', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.updateScore('user-3', 300);
      await repository.updateScore('user-4', 400);

      const top3 = await repository.getTop(3);

      expect(top3).toHaveLength(3);
      expect(top3[0]?.userId).toBe('user-4');
      expect(top3[0]?.score).toBe(400);
      expect(top3[0]?.rank).toBe(1);
      expect(top3[1]?.userId).toBe('user-3');
      expect(top3[2]?.userId).toBe('user-2');
    });

    it('should return empty array when no users', async () => {
      const top = await repository.getTop(10);
      expect(top).toEqual([]);
    });

    it('should handle requesting more than available', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);

      const top10 = await repository.getTop(10);

      expect(top10).toHaveLength(2);
    });

    it('should assign correct ranks', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.updateScore('user-3', 300);

      const top = await repository.getTop(3);

      expect(top[0]?.rank).toBe(1);
      expect(top[1]?.rank).toBe(2);
      expect(top[2]?.rank).toBe(3);
    });
  });

  describe('getUserNeighbors', () => {
    it('should return users around target user', async () => {
      for (let i = 1; i <= 10; i++) {
        await repository.updateScore(`user-${i}`, i * 100);
      }

      const neighbors = await repository.getUserNeighbors('user-5', 2, 2);

      expect(neighbors.length).toBeGreaterThanOrEqual(3);

      const userIds = neighbors.map((n) => n.userId);
      expect(userIds).toContain('user-5');
    });

    it('should return empty array for non-existent user', async () => {
      const neighbors = await repository.getUserNeighbors('non-existent', 1, 1);
      expect(neighbors).toEqual([]);
    });

    it('should handle edge cases at top of leaderboard', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.updateScore('user-3', 300);

      const neighbors = await repository.getUserNeighbors('user-3', 5, 1);

      expect(neighbors.length).toBeGreaterThan(0);
      expect(neighbors.some((n) => n.userId === 'user-3')).toBe(true);
    });
  });

  describe('setUserData', () => {
    it('should store user metadata', async () => {
      await repository.setUserData('user-1', 'Alice');

      const username = await repository.getUserData('user-1');
      expect(username).toBe('Alice');
    });

    it('should update existing metadata', async () => {
      await repository.setUserData('user-1', 'Alice');
      await repository.setUserData('user-1', 'AliceUpdated');

      const username = await repository.getUserData('user-1');
      expect(username).toBe('AliceUpdated');
    });
  });

  describe('getUserData', () => {
    it('should return user metadata', async () => {
      await repository.setUserData('user-1', 'Bob');

      const username = await repository.getUserData('user-1');
      expect(username).toBe('Bob');
    });

    it('should return null for non-existent user', async () => {
      const username = await repository.getUserData('non-existent');
      expect(username).toBeNull();
    });
  });

  describe('getFullLeaderboard', () => {
    it('should return leaderboard with user data', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.setUserData('user-1', 'Alice');
      await repository.setUserData('user-2', 'Bob');

      const leaderboard = await repository.getFullLeaderboard(10);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0]?.userId).toBe('user-2');
      expect(leaderboard[0]?.username).toBe('Bob');
      expect(leaderboard[0]?.score).toBe(200);
      expect(leaderboard[0]?.rank).toBe(1);
    });

    it('should use Anonymous for missing user data', async () => {
      await repository.updateScore('user-1', 100);

      const leaderboard = await repository.getFullLeaderboard(10);

      expect(leaderboard[0]?.username).toBe('Anonymous');
    });

    it('should respect limit parameter', async () => {
      for (let i = 1; i <= 10; i++) {
        await repository.updateScore(`user-${i}`, i * 100);
      }

      const leaderboard = await repository.getFullLeaderboard(5);

      expect(leaderboard).toHaveLength(5);
    });
  });

  describe('removeUser', () => {
    it('should remove user from leaderboard', async () => {
      await repository.updateScore('user-1', 100);
      await repository.setUserData('user-1', 'Alice');

      await repository.removeUser('user-1');

      const score = await repository.getUserScore('user-1');
      const username = await repository.getUserData('user-1');

      expect(score).toBe(0);
      expect(username).toBeNull();
    });

    it('should not throw for non-existent user', async () => {
      await expect(repository.removeUser('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getTotalUsers', () => {
    it('should return total number of users', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.updateScore('user-3', 300);

      const total = await repository.getTotalUsers();

      expect(total).toBe(3);
    });

    it('should return 0 when no users', async () => {
      const total = await repository.getTotalUsers();
      expect(total).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear entire leaderboard', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 200);
      await repository.setUserData('user-1', 'Alice');
      await repository.setUserData('user-2', 'Bob');

      await repository.clear();

      const total = await repository.getTotalUsers();
      const user1Data = await repository.getUserData('user-1');
      const user2Data = await repository.getUserData('user-2');

      expect(total).toBe(0);
      expect(user1Data).toBeNull();
      expect(user2Data).toBeNull();
    });

    it('should handle empty leaderboard', async () => {
      await expect(repository.clear()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero score', async () => {
      await repository.updateScore('user-1', 0);

      const score = await repository.getUserScore('user-1');
      expect(score).toBe(0);
    });

    it('should handle very large scores', async () => {
      await repository.updateScore('user-1', 999999999);

      const score = await repository.getUserScore('user-1');
      expect(score).toBe(999999999);
    });

    it('should handle tie scores', async () => {
      await repository.updateScore('user-1', 100);
      await repository.updateScore('user-2', 100);
      await repository.updateScore('user-3', 100);

      const top = await repository.getTop(3);

      expect(top).toHaveLength(3);
      expect(top.every((entry) => entry.score === 100)).toBe(true);
    });

    it('should handle rapid score updates', async () => {
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(repository.incrementScore('user-1', 10));
      }

      await Promise.all(updates);

      const score = await repository.getUserScore('user-1');
      expect(score).toBeGreaterThan(0);
    });
  });
});
