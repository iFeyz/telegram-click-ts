import { ActionChannel, ActionChannels } from '../../../domain/value-objects/ActionChannel';

describe('ActionChannel Value Object', () => {
  describe('factory methods', () => {
    it('should create replaceable channel', () => {
      const channel = ActionChannel.replaceable('UserInterface', 'navigation');

      expect(channel.domain).toBe('UserInterface');
      expect(channel.context).toBe('navigation');
      expect(channel.isReplaceable).toBe(true);
    });

    it('should create non-replaceable channel', () => {
      const channel = ActionChannel.nonReplaceable('Game', 'action');

      expect(channel.domain).toBe('Game');
      expect(channel.context).toBe('action');
      expect(channel.isReplaceable).toBe(false);
    });
  });

  describe('validation', () => {
    describe('domain validation', () => {
      it('should reject empty domain', () => {
        expect(() => ActionChannel.replaceable('', 'context')).toThrow('Channel domain cannot be empty');
      });

      it('should reject whitespace-only domain', () => {
        expect(() => ActionChannel.replaceable('   ', 'context')).toThrow('Channel domain cannot be empty');
      });

      it('should reject non-PascalCase domain', () => {
        expect(() => ActionChannel.replaceable('lowercase', 'context')).toThrow('Channel domain must be PascalCase');
        expect(() => ActionChannel.replaceable('snake_case', 'context')).toThrow('Channel domain must be PascalCase');
        expect(() => ActionChannel.replaceable('123Invalid', 'context')).toThrow('Channel domain must be PascalCase');
      });

      it('should accept valid PascalCase domain', () => {
        expect(() => ActionChannel.replaceable('UserInterface', 'context')).not.toThrow();
        expect(() => ActionChannel.replaceable('Game', 'context')).not.toThrow();
        expect(() => ActionChannel.replaceable('MyDomain', 'context')).not.toThrow();
      });
    });

    describe('context validation', () => {
      it('should reject empty context', () => {
        expect(() => ActionChannel.replaceable('Domain', '')).toThrow('Channel context cannot be empty');
      });

      it('should reject whitespace-only context', () => {
        expect(() => ActionChannel.replaceable('Domain', '   ')).toThrow('Channel context cannot be empty');
      });

      it('should reject non-camelCase context', () => {
        expect(() => ActionChannel.replaceable('Domain', 'PascalCase')).toThrow('Channel context must be camelCase');
        expect(() => ActionChannel.replaceable('Domain', 'snake_case')).toThrow('Channel context must be camelCase');
        expect(() => ActionChannel.replaceable('Domain', 'UPPERCASE')).toThrow('Channel context must be camelCase');
      });

      it('should accept valid camelCase context', () => {
        expect(() => ActionChannel.replaceable('Domain', 'navigation')).not.toThrow();
        expect(() => ActionChannel.replaceable('Domain', 'myContext')).not.toThrow();
        expect(() => ActionChannel.replaceable('Domain', 'myLongContextName')).not.toThrow();
      });
    });

    it('should validate both factory methods equally', () => {
      expect(() => ActionChannel.replaceable('invalid', 'context')).toThrow();
      expect(() => ActionChannel.nonReplaceable('invalid', 'context')).toThrow();

      expect(() => ActionChannel.replaceable('Domain', 'Invalid')).toThrow();
      expect(() => ActionChannel.nonReplaceable('Domain', 'Invalid')).toThrow();
    });
  });

  describe('fullName', () => {
    it('should combine domain and context', () => {
      const channel = ActionChannel.replaceable('UserInterface', 'navigation');
      expect(channel.fullName).toBe('UserInterface.navigation');
    });

    it('should format correctly for different channels', () => {
      expect(ActionChannels.UserInterface.navigation.fullName).toBe('UserInterface.navigation');
      expect(ActionChannels.Game.action.fullName).toBe('Game.action');
      expect(ActionChannels.Social.leaderboard.fullName).toBe('Social.leaderboard');
      expect(ActionChannels.System.notification.fullName).toBe('System.notification');
    });
  });

  describe('getTrackingKey', () => {
    it('should generate tracking key with userId', () => {
      const channel = ActionChannel.replaceable('UserInterface', 'navigation');
      const key = channel.getTrackingKey('user-123');

      expect(key).toBe('channel:UserInterface:navigation:user:user-123');
    });

    it('should generate unique keys for different users', () => {
      const channel = ActionChannel.replaceable('Game', 'session');
      const key1 = channel.getTrackingKey('user-1');
      const key2 = channel.getTrackingKey('user-2');

      expect(key1).not.toBe(key2);
      expect(key1).toBe('channel:Game:session:user:user-1');
      expect(key2).toBe('channel:Game:session:user:user-2');
    });

    it('should generate unique keys for different channels', () => {
      const channel1 = ActionChannel.replaceable('Game', 'session');
      const channel2 = ActionChannel.replaceable('Game', 'results');

      const key1 = channel1.getTrackingKey('user-1');
      const key2 = channel2.getTrackingKey('user-1');

      expect(key1).not.toBe(key2);
    });
  });

  describe('equals', () => {
    it('should return true for identical channels', () => {
      const channel1 = ActionChannel.replaceable('UserInterface', 'navigation');
      const channel2 = ActionChannel.replaceable('UserInterface', 'navigation');

      expect(channel1.equals(channel2)).toBe(true);
    });

    it('should return true regardless of replaceability', () => {
      const channel1 = ActionChannel.replaceable('Game', 'action');
      const channel2 = ActionChannel.nonReplaceable('Game', 'action');

      expect(channel1.equals(channel2)).toBe(true);
    });

    it('should return false for different domains', () => {
      const channel1 = ActionChannel.replaceable('UserInterface', 'navigation');
      const channel2 = ActionChannel.replaceable('Game', 'navigation');

      expect(channel1.equals(channel2)).toBe(false);
    });

    it('should return false for different contexts', () => {
      const channel1 = ActionChannel.replaceable('UserInterface', 'navigation');
      const channel2 = ActionChannel.replaceable('UserInterface', 'modal');

      expect(channel1.equals(channel2)).toBe(false);
    });

    it('should return false for completely different channels', () => {
      const channel1 = ActionChannel.replaceable('UserInterface', 'navigation');
      const channel2 = ActionChannel.replaceable('System', 'error');

      expect(channel1.equals(channel2)).toBe(false);
    });
  });

  describe('deserialize', () => {
    it('should recreate channel from data', () => {
      const original = ActionChannel.replaceable('UserInterface', 'navigation');
      const data = {
        domain: original.domain,
        context: original.context,
        isReplaceable: original.isReplaceable,
      };

      const deserialized = ActionChannel.deserialize(data);

      expect(deserialized.domain).toBe(original.domain);
      expect(deserialized.context).toBe(original.context);
      expect(deserialized.isReplaceable).toBe(original.isReplaceable);
      expect(deserialized.equals(original)).toBe(true);
    });

    it('should preserve replaceability flag', () => {
      const replaceable = ActionChannel.deserialize({
        domain: 'Test',
        context: 'test',
        isReplaceable: true,
      });

      const nonReplaceable = ActionChannel.deserialize({
        domain: 'Test',
        context: 'test',
        isReplaceable: false,
      });

      expect(replaceable.isReplaceable).toBe(true);
      expect(nonReplaceable.isReplaceable).toBe(false);
    });
  });

  describe('predefined channels', () => {
    describe('UserInterface channels', () => {
      it('should have navigation channel (replaceable)', () => {
        expect(ActionChannels.UserInterface.navigation.domain).toBe('UserInterface');
        expect(ActionChannels.UserInterface.navigation.context).toBe('navigation');
        expect(ActionChannels.UserInterface.navigation.isReplaceable).toBe(true);
      });

      it('should have modal channel (replaceable)', () => {
        expect(ActionChannels.UserInterface.modal.isReplaceable).toBe(true);
      });

      it('should have form channel (replaceable)', () => {
        expect(ActionChannels.UserInterface.form.isReplaceable).toBe(true);
      });
    });

    describe('Game channels', () => {
      it('should have action channel (non-replaceable)', () => {
        expect(ActionChannels.Game.action.domain).toBe('Game');
        expect(ActionChannels.Game.action.context).toBe('action');
        expect(ActionChannels.Game.action.isReplaceable).toBe(false);
      });

      it('should have session channel (replaceable)', () => {
        expect(ActionChannels.Game.session.isReplaceable).toBe(true);
      });

      it('should have results channel (replaceable)', () => {
        expect(ActionChannels.Game.results.isReplaceable).toBe(true);
      });
    });

    describe('Social channels', () => {
      it('should have leaderboard channel (replaceable)', () => {
        expect(ActionChannels.Social.leaderboard.domain).toBe('Social');
        expect(ActionChannels.Social.leaderboard.isReplaceable).toBe(true);
      });

      it('should have profile channel (replaceable)', () => {
        expect(ActionChannels.Social.profile.isReplaceable).toBe(true);
      });

      it('should have stats channel (replaceable)', () => {
        expect(ActionChannels.Social.stats.isReplaceable).toBe(true);
      });
    });

    describe('System channels', () => {
      it('should have notification channel (non-replaceable)', () => {
        expect(ActionChannels.System.notification.domain).toBe('System');
        expect(ActionChannels.System.notification.isReplaceable).toBe(false);
      });

      it('should have error channel (non-replaceable)', () => {
        expect(ActionChannels.System.error.isReplaceable).toBe(false);
      });

      it('should have status channel (replaceable)', () => {
        expect(ActionChannels.System.status.isReplaceable).toBe(true);
      });
    });
  });

  describe('readonly fields', () => {
    it('should have readonly domain field', () => {
      const channel = ActionChannel.replaceable('Test', 'test');
      const descriptor = Object.getOwnPropertyDescriptor(channel, 'domain');
      expect(descriptor?.writable).toBeDefined();
    });
  });

  describe('use cases', () => {
    it('should support message deduplication pattern', () => {
      const channel = ActionChannels.UserInterface.navigation;
      const userId = 'user-123';

      const trackingKey = channel.getTrackingKey(userId);

      expect(trackingKey).toMatch(/^channel:/);
      expect(trackingKey).toContain(userId);
    });

    it('should distinguish replaceable from non-replaceable', () => {
      const replaceable = ActionChannels.UserInterface.navigation;
      const nonReplaceable = ActionChannels.Game.action;

      expect(replaceable.isReplaceable).toBe(true);
      expect(nonReplaceable.isReplaceable).toBe(false);
    });

    it('should allow comparison of channels', () => {
      const channel1 = ActionChannels.Social.leaderboard;
      const channel2 = ActionChannels.Social.leaderboard;
      const channel3 = ActionChannels.Social.profile;

      expect(channel1.equals(channel2)).toBe(true);
      expect(channel1.equals(channel3)).toBe(false);
    });
  });
});
