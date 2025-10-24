import { Click } from '../../../domain/value-objects/Click';
import { ValidationError, InvalidClickError } from '../../../shared/errors';
import {
  createTestClick,
  createOldClick,
  createRecentClick,
  SAMPLE_CLICKS,
  INVALID_CLICK_DATA,
} from '../../fixtures/clickFixtures';

describe('Click Value Object', () => {
  describe('constructor', () => {
    it('should create click with valid data', () => {
      const click = new Click({
        userId: 'user-1',
        count: 10,
      });

      expect(click.userId).toBe('user-1');
      expect(click.count).toBe(10);
      expect(click.timestamp).toBeInstanceOf(Date);
    });

    it('should accept custom timestamp', () => {
      const timestamp = new Date('2024-01-01');
      const click = new Click({
        userId: 'user-1',
        count: 5,
        timestamp,
      });

      expect(click.timestamp).toBe(timestamp);
    });

    it('should allow count of 1', () => {
      const click = createTestClick({ count: 1 });
      expect(click.count).toBe(1);
    });

    it('should allow count of 100 (max)', () => {
      const click = createTestClick({ count: 100 });
      expect(click.count).toBe(100);
    });
  });

  describe('validation', () => {
    it('should throw ValidationError for non-integer count', () => {
      expect(() => new Click(INVALID_CLICK_DATA.decimal)).toThrow(ValidationError);
      expect(() => new Click(INVALID_CLICK_DATA.decimal)).toThrow('Must be an integer');
    });

    it('should throw InvalidClickError for zero count', () => {
      expect(() => new Click(INVALID_CLICK_DATA.zero)).toThrow(InvalidClickError);
      expect(() => new Click(INVALID_CLICK_DATA.zero)).toThrow('Click count must be positive');
    });

    it('should throw InvalidClickError for negative count', () => {
      expect(() => new Click(INVALID_CLICK_DATA.negative)).toThrow(InvalidClickError);
      expect(() => new Click(INVALID_CLICK_DATA.negative)).toThrow('Click count must be positive');
    });

    it('should throw InvalidClickError for count > 100', () => {
      expect(() => new Click(INVALID_CLICK_DATA.tooLarge)).toThrow(InvalidClickError);
      expect(() => new Click(INVALID_CLICK_DATA.tooLarge)).toThrow('Click count cannot exceed 100 per batch');
    });

    it('should validate on construction', () => {
      const validCounts = [1, 10, 50, 100];
      validCounts.forEach((count) => {
        expect(() => createTestClick({ count })).not.toThrow();
      });

      const invalidCounts = [0, -1, 101, 1000, 0.5];
      invalidCounts.forEach((count) => {
        expect(() => new Click({ userId: 'user-1', count })).toThrow();
      });
    });
  });

  describe('isRecent', () => {
    it('should return true for recent click (default 5s window)', () => {
      const click = createRecentClick();
      expect(click.isRecent()).toBe(true);
    });

    it('should return false for old click (default 5s window)', () => {
      const click = createOldClick('user-1', 10000);
      expect(click.isRecent()).toBe(false);
    });

    it('should respect custom window', () => {
      const click = createOldClick('user-1', 3000);

      expect(click.isRecent(2000)).toBe(false);
      expect(click.isRecent(4000)).toBe(true);
    });

    it('should handle exact boundary', () => {
      const click = createOldClick('user-1', 5000);
      expect(click.isRecent(5000)).toBe(false);
      expect(click.isRecent(5001)).toBe(true);
    });
  });

  describe('createBatch', () => {
    it('should create multiple clicks', () => {
      const counts = [10, 20, 30];
      const batch = Click.createBatch('user-1', counts);

      expect(batch).toHaveLength(3);
      expect(batch[0]?.count).toBe(10);
      expect(batch[1]?.count).toBe(20);
      expect(batch[2]?.count).toBe(30);
      batch.forEach((click) => {
        expect(click.userId).toBe('user-1');
      });
    });

    it('should create empty batch from empty array', () => {
      const batch = Click.createBatch('user-1', []);
      expect(batch).toHaveLength(0);
    });

    it('should validate each click in batch', () => {
      expect(() => Click.createBatch('user-1', [10, 101])).toThrow(InvalidClickError);
      expect(() => Click.createBatch('user-1', [10, 0])).toThrow(InvalidClickError);
      expect(() => Click.createBatch('user-1', [10, -5])).toThrow(InvalidClickError);
    });

    it('should handle single-item batch', () => {
      const batch = Click.createBatch('user-1', [50]);
      expect(batch).toHaveLength(1);
      expect(batch[0]?.count).toBe(50);
    });
  });

  describe('aggregate', () => {
    it('should aggregate clicks by userId', () => {
      const clicks = SAMPLE_CLICKS.multiUser;
      const aggregated = Click.aggregate(clicks);

      expect(aggregated.get('user-1')).toBe(15);
      expect(aggregated.get('user-2')).toBe(35);
      expect(aggregated.get('user-3')).toBe(30);
    });

    it('should handle single user clicks', () => {
      const clicks = [
        createTestClick({ userId: 'user-1', count: 10 }),
        createTestClick({ userId: 'user-1', count: 20 }),
        createTestClick({ userId: 'user-1', count: 30 }),
      ];

      const aggregated = Click.aggregate(clicks);
      expect(aggregated.get('user-1')).toBe(60);
      expect(aggregated.size).toBe(1);
    });

    it('should handle empty array', () => {
      const aggregated = Click.aggregate([]);
      expect(aggregated.size).toBe(0);
    });

    it('should handle single click', () => {
      const click = createTestClick({ userId: 'user-1', count: 50 });
      const aggregated = Click.aggregate([click]);

      expect(aggregated.get('user-1')).toBe(50);
      expect(aggregated.size).toBe(1);
    });

    it('should preserve Map structure', () => {
      const clicks = [
        createTestClick({ userId: 'user-1', count: 10 }),
        createTestClick({ userId: 'user-2', count: 20 }),
      ];

      const aggregated = Click.aggregate(clicks);
      expect(aggregated).toBeInstanceOf(Map);
      expect(Array.from(aggregated.keys())).toEqual(['user-1', 'user-2']);
    });
  });

  describe('toJSON', () => {
    it('should serialize click correctly', () => {
      const timestamp = new Date('2024-01-01T12:00:00Z');
      const click = new Click({
        userId: 'user-1',
        count: 25,
        timestamp,
      });

      const json = click.toJSON();

      expect(json.userId).toBe('user-1');
      expect(json.count).toBe(25);
      expect(json.timestamp).toBe('2024-01-01T12:00:00.000Z');
    });

    it('should convert timestamp to ISO string', () => {
      const click = createTestClick();
      const json = click.toJSON();

      expect(typeof json.timestamp).toBe('string');
      expect(new Date(json.timestamp as string)).toBeInstanceOf(Date);
    });
  });

  describe('readonly fields', () => {
    it('should have readonly userId field', () => {
      const click = createTestClick();
      const descriptor = Object.getOwnPropertyDescriptor(click, 'userId');
      expect(descriptor?.writable).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive clicks', () => {
      const clicks = Array.from({ length: 10 }, () =>
        createTestClick({ userId: 'user-1', count: 10 })
      );

      const aggregated = Click.aggregate(clicks);
      expect(aggregated.get('user-1')).toBe(100);
    });

    it('should handle boundary values correctly', () => {
      const minClick = createTestClick({ count: 1 });
      const maxClick = createTestClick({ count: 100 });

      expect(minClick.count).toBe(1);
      expect(maxClick.count).toBe(100);
    });

    it('should handle multiple batches', () => {
      const batch1 = Click.createBatch('user-1', [10, 20]);
      const batch2 = Click.createBatch('user-1', [30, 40]);

      const allClicks = [...batch1, ...batch2];
      const aggregated = Click.aggregate(allClicks);

      expect(aggregated.get('user-1')).toBe(100);
    });
  });
});
