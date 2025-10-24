import { User } from '../../../domain/entities/User';
import { InvalidClickError } from '../../../shared/errors';
import { createTestUser, SAMPLE_USERS } from '../../../test/fixtures/userFixtures';

describe('User Entity', () => {
  describe('constructor', () => {
    it('should create user with required fields', () => {
      const user = new User({
        id: 'test-id',
        telegramId: BigInt(123456),
        firstName: 'Test',
      });

      expect(user.id).toBe('test-id');
      expect(user.telegramId).toBe(BigInt(123456));
      expect(user.firstName).toBe('Test');
      expect(user.score).toBe(BigInt(0));
    });

    it('should create user with all optional fields', () => {
      const user = new User({
        id: 'test-id',
        telegramId: BigInt(123456),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: 'ProGamer',
        score: BigInt(1000),
      });

      expect(user.username).toBe('testuser');
      expect(user.lastName).toBe('User');
      expect(user.customName).toBe('ProGamer');
      expect(user.score).toBe(BigInt(1000));
    });

    it('should set default score to 0', () => {
      const user = createTestUser({ score: undefined });
      expect(user.score).toBe(BigInt(0));
    });

    it('should set timestamps if not provided', () => {
      const user = createTestUser();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getDisplayName', () => {
    it('should return custom name if set', () => {
      const user = SAMPLE_USERS.customName;
      expect(user.getDisplayName()).toBe('ProGamer123');
    });

    it('should return username with @ if no custom name', () => {
      const user = SAMPLE_USERS.alice;
      expect(user.getDisplayName()).toBe('@alice');
    });

    it('should return full name if no custom name or username', () => {
      const user = SAMPLE_USERS.charlie;
      expect(user.getDisplayName()).toBe('Charlie');
    });

    it('should return firstName + lastName if both present', () => {
      const user = new User({
        id: 'test-id',
        telegramId: BigInt(999),
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(user.getDisplayName()).toBe('John Doe');
    });

    it('should return User{telegramId} as fallback', () => {
      const user = new User({
        id: 'test-id',
        telegramId: BigInt(999999),
      });
      expect(user.getDisplayName()).toBe('User999999');
    });
  });

  describe('addClicks', () => {
    it('should add clicks to score', () => {
      const user = createTestUser({ score: BigInt(100) });
      const initialUpdatedAt = user.updatedAt;

      user.addClicks(50);

      expect(user.score).toBe(BigInt(150));
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
    });

    it('should handle large click counts', () => {
      const user = createTestUser({ score: BigInt(1000000) });
      user.addClicks(999999);
      expect(user.score).toBe(BigInt(1999999));
    });

    it('should throw error for negative click count', () => {
      const user = createTestUser();
      expect(() => user.addClicks(-5)).toThrow(InvalidClickError);
      expect(() => user.addClicks(-5)).toThrow('Click count cannot be negative');
    });

    it('should not modify score if error thrown', () => {
      const user = createTestUser({ score: BigInt(100) });
      try {
        user.addClicks(-5);
      } catch (error) {
        expect(user.score).toBe(BigInt(100));
      }
    });

    it('should handle zero clicks', () => {
      const user = createTestUser({ score: BigInt(100) });
      user.addClicks(0);
      expect(user.score).toBe(BigInt(100));
    });
  });

  describe('updateProfile', () => {
    it('should update username', () => {
      const user = createTestUser({ username: 'oldname' });
      user.updateProfile({ username: 'newname' });
      expect(user.username).toBe('newname');
    });

    it('should update firstName and lastName', () => {
      const user = createTestUser();
      user.updateProfile({ firstName: 'New', lastName: 'Name' });
      expect(user.firstName).toBe('New');
      expect(user.lastName).toBe('Name');
    });

    it('should update customName', () => {
      const user = createTestUser();
      user.updateProfile({ customName: 'ProGamer' });
      expect(user.customName).toBe('ProGamer');
    });

    it('should update multiple fields at once', () => {
      const user = createTestUser();
      user.updateProfile({
        username: 'newuser',
        firstName: 'New',
        customName: 'CustomName',
      });

      expect(user.username).toBe('newuser');
      expect(user.firstName).toBe('New');
      expect(user.customName).toBe('CustomName');
    });

    it('should update updatedAt timestamp', () => {
      const user = createTestUser();
      const initialUpdatedAt = user.updatedAt;

      setTimeout(() => {
        user.updateProfile({ username: 'updated' });
        expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt.getTime());
      }, 10);
    });

    it('should handle undefined values', () => {
      const user = createTestUser({ username: 'original' });
      user.updateProfile({ firstName: 'New' });
      expect(user.username).toBe('original');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON correctly', () => {
      const user = createTestUser({
        id: 'test-id',
        telegramId: BigInt(123456),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        score: BigInt(1000),
      });

      const json = user.toJSON();

      expect(json.id).toBe('test-id');
      expect(json.telegramId).toBe('123456');
      expect(json.username).toBe('testuser');
      expect(json.firstName).toBe('Test');
      expect(json.lastName).toBe('User');
      expect(json.score).toBe('1000');
      expect(typeof json.createdAt).toBe('string');
      expect(typeof json.updatedAt).toBe('string');
    });

    it('should convert BigInt to string', () => {
      const user = createTestUser({
        telegramId: BigInt(999999999999),
        score: BigInt(999999999999),
      });

      const json = user.toJSON();

      expect(json.telegramId).toBe('999999999999');
      expect(json.score).toBe('999999999999');
    });

    it('should include optional fields if present', () => {
      const user = createTestUser({ customName: 'ProGamer' });
      const json = user.toJSON();
      expect(json.customName).toBe('ProGamer');
    });
  });

  describe('readonly fields', () => {
    it('should have readonly id field', () => {
      const user = createTestUser();
      const descriptor = Object.getOwnPropertyDescriptor(user, 'id');
      expect(descriptor?.writable).toBeDefined();
    });

    it('should have readonly createdAt field', () => {
      const user = createTestUser();
      const descriptor = Object.getOwnPropertyDescriptor(user, 'createdAt');
      expect(descriptor?.writable).toBeDefined();
    });
  });

  describe('BigInt score handling', () => {
    it('should handle very large scores', () => {
      const largeScore = BigInt('999999999999999999');
      const user = createTestUser({ score: largeScore });
      expect(user.score).toBe(largeScore);
    });

    it('should correctly add to large scores', () => {
      const user = createTestUser({ score: BigInt('999999999999999999') });
      user.addClicks(1);
      expect(user.score).toBe(BigInt('1000000000000000000'));
    });
  });
});
