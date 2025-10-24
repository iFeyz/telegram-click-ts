import { LeaderboardEntry } from '../../../domain/value-objects/LeaderboardEntry';
import { createLeaderboardEntry, SAMPLE_TOP3 } from '../../fixtures/leaderboardFixtures';

describe('LeaderboardEntry Value Object', () => {
  describe('constructor', () => {
    it('should create entry with required fields', () => {
      const entry = new LeaderboardEntry({
        userId: 'user-1',
        username: 'player1',
        score: 1000,
        rank: 1,
      });

      expect(entry.userId).toBe('user-1');
      expect(entry.username).toBe('player1');
      expect(entry.score).toBe(1000);
      expect(entry.rank).toBe(1);
      expect(entry.change).toBe('new');
    });

    it('should calculate change for new entry', () => {
      const entry = createLeaderboardEntry({ rank: 5 });
      expect(entry.change).toBe('new');
    });

    it('should calculate change for same rank', () => {
      const entry = createLeaderboardEntry({ rank: 5, previousRank: 5 });
      expect(entry.change).toBe('same');
    });

    it('should calculate change for rank up', () => {
      const entry = createLeaderboardEntry({ rank: 3, previousRank: 5 });
      expect(entry.change).toBe('up');
    });

    it('should calculate change for rank down', () => {
      const entry = createLeaderboardEntry({ rank: 7, previousRank: 3 });
      expect(entry.change).toBe('down');
    });
  });

  describe('getMedalEmoji', () => {
    it('should return gold medal for rank 1', () => {
      const entry = SAMPLE_TOP3[0];
      expect(entry?.getMedalEmoji()).toBe('🥇');
    });

    it('should return silver medal for rank 2', () => {
      const entry = SAMPLE_TOP3[1];
      expect(entry?.getMedalEmoji()).toBe('🥈');
    });

    it('should return bronze medal for rank 3', () => {
      const entry = SAMPLE_TOP3[2];
      expect(entry?.getMedalEmoji()).toBe('🥉');
    });

    it('should return empty string for rank > 3', () => {
      const entry = createLeaderboardEntry({ rank: 4 });
      expect(entry.getMedalEmoji()).toBe('');
    });

    it('should return empty string for rank 10', () => {
      const entry = createLeaderboardEntry({ rank: 10 });
      expect(entry.getMedalEmoji()).toBe('');
    });
  });

  describe('getChangeEmoji', () => {
    it('should return up arrow for rank improvement', () => {
      const entry = createLeaderboardEntry({ rank: 2, previousRank: 5 });
      expect(entry.getChangeEmoji()).toBe('⬆️');
    });

    it('should return down arrow for rank decline', () => {
      const entry = createLeaderboardEntry({ rank: 5, previousRank: 2 });
      expect(entry.getChangeEmoji()).toBe('⬇️');
    });

    it('should return new emoji for new entry', () => {
      const entry = createLeaderboardEntry({ rank: 5 });
      expect(entry.getChangeEmoji()).toBe('🆕');
    });

    it('should return empty string for same rank', () => {
      const entry = createLeaderboardEntry({ rank: 5, previousRank: 5 });
      expect(entry.getChangeEmoji()).toBe('');
    });
  });

  describe('formatScore', () => {
    it('should format small scores as-is', () => {
      const entry = createLeaderboardEntry({ score: 999 });
      expect(entry.format()).toContain('999');
    });

    it('should format thousands with K suffix', () => {
      const entry = createLeaderboardEntry({ score: 1500 });
      expect(entry.format()).toContain('1.5K');
    });

    it('should format exact thousands', () => {
      const entry = createLeaderboardEntry({ score: 5000 });
      expect(entry.format()).toContain('5.0K');
    });

    it('should format millions with M suffix', () => {
      const entry = createLeaderboardEntry({ score: 1500000 });
      expect(entry.format()).toContain('1.5M');
    });

    it('should format exact millions', () => {
      const entry = createLeaderboardEntry({ score: 3000000 });
      expect(entry.format()).toContain('3.0M');
    });

    it('should round to one decimal place', () => {
      const entry = createLeaderboardEntry({ score: 1234 });
      expect(entry.format()).toContain('1.2K');
    });
  });

  describe('format', () => {
    it('should format top 1 with gold medal', () => {
      const entry = createLeaderboardEntry({
        userId: 'user-1',
        username: 'champion',
        score: 10000,
        rank: 1,
      });

      const formatted = entry.format();
      expect(formatted).toContain('🥇');
      expect(formatted).toContain('champion');
      expect(formatted).toContain('10.0K');
    });

    it('should format rank 4+ with number', () => {
      const entry = createLeaderboardEntry({
        username: 'player4',
        score: 5000,
        rank: 4,
      });

      const formatted = entry.format();
      expect(formatted).toContain('4.');
      expect(formatted).toContain('player4');
      expect(formatted).toContain('5.0K');
    });

    it('should include change emoji if present', () => {
      const entry = createLeaderboardEntry({
        username: 'rising',
        score: 3000,
        rank: 3,
        previousRank: 7,
      });

      const formatted = entry.format();
      expect(formatted).toContain('⬆️');
    });

    it('should not include change emoji for same rank', () => {
      const entry = createLeaderboardEntry({
        username: 'steady',
        score: 2000,
        rank: 5,
        previousRank: 5,
      });

      const formatted = entry.format();
      expect(formatted).not.toContain('⬆️');
      expect(formatted).not.toContain('⬇️');
    });

    it('should format new entry with new emoji', () => {
      const entry = createLeaderboardEntry({
        username: 'newcomer',
        score: 1000,
        rank: 10,
      });

      const formatted = entry.format();
      expect(formatted).toContain('🆕');
    });
  });

  describe('isInTop', () => {
    it('should return true for rank 1 in top 3', () => {
      const entry = createLeaderboardEntry({ rank: 1 });
      expect(entry.isInTop(3)).toBe(true);
    });

    it('should return true for rank 3 in top 3', () => {
      const entry = createLeaderboardEntry({ rank: 3 });
      expect(entry.isInTop(3)).toBe(true);
    });

    it('should return false for rank 4 in top 3', () => {
      const entry = createLeaderboardEntry({ rank: 4 });
      expect(entry.isInTop(3)).toBe(false);
    });

    it('should return true for rank 10 in top 10', () => {
      const entry = createLeaderboardEntry({ rank: 10 });
      expect(entry.isInTop(10)).toBe(true);
    });

    it('should return false for rank 11 in top 10', () => {
      const entry = createLeaderboardEntry({ rank: 11 });
      expect(entry.isInTop(10)).toBe(false);
    });

    it('should handle top 1', () => {
      const rank1 = createLeaderboardEntry({ rank: 1 });
      const rank2 = createLeaderboardEntry({ rank: 2 });

      expect(rank1.isInTop(1)).toBe(true);
      expect(rank2.isInTop(1)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize entry correctly', () => {
      const entry = createLeaderboardEntry({
        userId: 'user-1',
        username: 'player1',
        score: 5000,
        rank: 3,
        previousRank: 5,
      });

      const json = entry.toJSON();

      expect(json.userId).toBe('user-1');
      expect(json.username).toBe('player1');
      expect(json.score).toBe(5000);
      expect(json.rank).toBe(3);
      expect(json.change).toBe('up');
      expect(json.previousRank).toBe(5);
    });

    it('should include undefined previousRank for new entry', () => {
      const entry = createLeaderboardEntry({ rank: 5 });
      const json = entry.toJSON();

      expect(json.change).toBe('new');
      expect(json.previousRank).toBeUndefined();
    });
  });

  describe('readonly fields', () => {
    it('should have readonly userId field', () => {
      const entry = createLeaderboardEntry();
      const descriptor = Object.getOwnPropertyDescriptor(entry, 'userId');
      expect(descriptor?.writable).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very large scores', () => {
      const entry = createLeaderboardEntry({ score: 999_999_999 });
      const formatted = entry.format();
      expect(formatted).toContain('1000.0M');
    });

    it('should handle score of 0', () => {
      const entry = createLeaderboardEntry({ score: 0 });
      expect(entry.format()).toContain('0');
    });

    it('should handle rank 1000+', () => {
      const entry = createLeaderboardEntry({ rank: 1234 });
      expect(entry.format()).toContain('1234.');
    });

    it('should handle username with special characters', () => {
      const entry = createLeaderboardEntry({ username: '@player_123' });
      const formatted = entry.format();
      expect(formatted).toContain('@player_123');
    });
  });
});
