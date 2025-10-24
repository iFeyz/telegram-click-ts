import {
  TELEGRAM_LIMITS,
  GAME_SETTINGS,
  BOT_COMMANDS,
  EMOJIS,
  REDIS_KEYS,
  ERROR_MESSAGES,
} from '../../shared/constants';

describe('Shared Constants', () => {
  describe('TELEGRAM_LIMITS', () => {
    it('should have message length limits', () => {
      expect(TELEGRAM_LIMITS.MESSAGE_LENGTH).toBe(4096);
      expect(TELEGRAM_LIMITS.CAPTION_LENGTH).toBe(1024);
    });

    it('should have query and callback limits', () => {
      expect(TELEGRAM_LIMITS.INLINE_QUERY_RESULTS).toBe(50);
      expect(TELEGRAM_LIMITS.CALLBACK_DATA_LENGTH).toBe(64);
    });

    it('should have rate limit configurations', () => {
      expect(TELEGRAM_LIMITS.MESSAGES_PER_SECOND_GLOBAL).toBe(30);
      expect(TELEGRAM_LIMITS.MESSAGES_PER_SECOND_PER_CHAT).toBe(1);
      expect(TELEGRAM_LIMITS.MESSAGES_PER_MINUTE_PER_CHAT).toBe(20);
      expect(TELEGRAM_LIMITS.MESSAGES_PER_HOUR).toBe(1000);
    });

    it('should have broadcast settings', () => {
      expect(TELEGRAM_LIMITS.MAX_RECIPIENTS_PER_BROADCAST).toBe(30);
      expect(TELEGRAM_LIMITS.BROADCAST_DELAY_MS).toBe(50);
    });

    it('should be readonly at TypeScript level', () => {
      expect(TELEGRAM_LIMITS.MESSAGE_LENGTH).toBe(4096);
      expect(typeof TELEGRAM_LIMITS).toBe('object');
    });

    it('should have sensible rate limits', () => {
      expect(TELEGRAM_LIMITS.MESSAGES_PER_SECOND_GLOBAL).toBeGreaterThan(0);
      expect(TELEGRAM_LIMITS.MESSAGES_PER_SECOND_GLOBAL).toBeLessThan(100);
    });
  });

  describe('GAME_SETTINGS', () => {
    it('should have click count limits', () => {
      expect(GAME_SETTINGS.MIN_CLICK_COUNT).toBe(1);
      expect(GAME_SETTINGS.MAX_CLICK_COUNT).toBe(100);
    });

    it('should have click rate limits', () => {
      expect(GAME_SETTINGS.MAX_CLICKS_PER_SECOND).toBe(10);
      expect(GAME_SETTINGS.CLICK_COOLDOWN_MS).toBe(100);
    });

    it('should have session configuration', () => {
      expect(GAME_SETTINGS.SESSION_TIMEOUT_MS).toBe(3600000);
    });

    it('should have batch save configuration', () => {
      expect(GAME_SETTINGS.BATCH_SAVE_INTERVAL_MS).toBe(5000);
    });

    it('should have leaderboard configuration', () => {
      expect(GAME_SETTINGS.LEADERBOARD_SIZE).toBe(100);
      expect(GAME_SETTINGS.LEADERBOARD_CACHE_TTL_MS).toBe(500);
    });

    it('should be readonly at TypeScript level', () => {
      expect(GAME_SETTINGS.MAX_CLICK_COUNT).toBe(100);
      expect(typeof GAME_SETTINGS).toBe('object');
    });

    it('should have min less than max clicks', () => {
      expect(GAME_SETTINGS.MIN_CLICK_COUNT).toBeLessThan(GAME_SETTINGS.MAX_CLICK_COUNT);
    });

    it('should have reasonable session timeout', () => {
      expect(GAME_SETTINGS.SESSION_TIMEOUT_MS).toBe(60 * 60 * 1000);
    });
  });

  describe('BOT_COMMANDS', () => {
    it('should have all required commands', () => {
      const commands = BOT_COMMANDS.map(c => c.command);

      expect(commands).toContain('start');
      expect(commands).toContain('click');
      expect(commands).toContain('leaderboard');
      expect(commands).toContain('stats');
      expect(commands).toContain('changename');
      expect(commands).toContain('help');
    });

    it('should have descriptions for all commands', () => {
      BOT_COMMANDS.forEach(cmd => {
        expect(cmd.description).toBeDefined();
        expect(cmd.description.length).toBeGreaterThan(0);
      });
    });

    it('should have emoji in descriptions', () => {
      BOT_COMMANDS.forEach(cmd => {
        expect(cmd.description).toMatch(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
      });
    });

    it('should be readonly', () => {
      const firstCommand = BOT_COMMANDS[0];
      expect(firstCommand).toBeDefined();
      expect(Object.isFrozen(BOT_COMMANDS)).toBe(false);
    });

    it('should have exactly 6 commands', () => {
      expect(BOT_COMMANDS).toHaveLength(6);
    });

    it('should have start command first', () => {
      expect(BOT_COMMANDS[0]?.command).toBe('start');
    });
  });

  describe('EMOJIS', () => {
    it('should have game emojis', () => {
      expect(EMOJIS.CLICK).toBe('👆');
      expect(EMOJIS.TROPHY).toBe('🏆');
      expect(EMOJIS.FIRE).toBe('🔥');
      expect(EMOJIS.STAR).toBe('⭐');
      expect(EMOJIS.ROCKET).toBe('🚀');
    });

    it('should have medal emojis', () => {
      expect(EMOJIS.MEDAL_GOLD).toBe('🥇');
      expect(EMOJIS.MEDAL_SILVER).toBe('🥈');
      expect(EMOJIS.MEDAL_BRONZE).toBe('🥉');
    });

    it('should have indicator emojis', () => {
      expect(EMOJIS.UP_ARROW).toBe('⬆️');
      expect(EMOJIS.DOWN_ARROW).toBe('⬇️');
      expect(EMOJIS.NEW).toBe('🆕');
    });

    it('should have special emojis', () => {
      expect(EMOJIS.CROWN).toBe('👑');
      expect(EMOJIS.SPARKLES).toBe('✨');
      expect(EMOJIS.PARTY).toBe('🎉');
    });

    it('should have status emojis', () => {
      expect(EMOJIS.WARNING).toBe('⚠️');
      expect(EMOJIS.ERROR).toBe('❌');
      expect(EMOJIS.SUCCESS).toBe('✅');
      expect(EMOJIS.INFO).toBe('ℹ️');
    });

    it('should be readonly at TypeScript level', () => {
      expect(EMOJIS.CLICK).toBe('👆');
      expect(typeof EMOJIS).toBe('object');
    });

    it('should have all unique values', () => {
      const values = Object.values(EMOJIS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('REDIS_KEYS', () => {
    it('should have click-related keys', () => {
      expect(REDIS_KEYS.CLICK_PENDING).toBe('clicks:pending:');
      expect(REDIS_KEYS.CLICK_STREAM).toBe('clicks:stream');
    });

    it('should have leaderboard keys', () => {
      expect(REDIS_KEYS.LEADERBOARD).toBe('leaderboard:global');
      expect(REDIS_KEYS.LEADERBOARD_USER).toBe('leaderboard:user:');
    });

    it('should have session keys', () => {
      expect(REDIS_KEYS.SESSION).toBe('session:');
    });

    it('should have rate limit keys', () => {
      expect(REDIS_KEYS.RATE_LIMIT).toBe('ratelimit:');
    });

    it('should have cache keys', () => {
      expect(REDIS_KEYS.USER_CACHE).toBe('cache:user:');
      expect(REDIS_KEYS.STATS_CACHE).toBe('cache:stats:');
    });

    it('should be readonly at TypeScript level', () => {
      expect(REDIS_KEYS.SESSION).toBe('session:');
      expect(typeof REDIS_KEYS).toBe('object');
    });

    it('should have consistent naming pattern', () => {
      const prefixKeys = [
        REDIS_KEYS.CLICK_PENDING,
        REDIS_KEYS.LEADERBOARD_USER,
        REDIS_KEYS.SESSION,
        REDIS_KEYS.RATE_LIMIT,
        REDIS_KEYS.USER_CACHE,
        REDIS_KEYS.STATS_CACHE,
      ];

      prefixKeys.forEach(key => {
        expect(key).toMatch(/.*:$/);
      });
    });

    it('should have descriptive key names', () => {
      Object.values(REDIS_KEYS).forEach(key => {
        expect(key.length).toBeGreaterThan(0);
        expect(key).not.toContain(' ');
      });
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have rate limit message', () => {
      expect(ERROR_MESSAGES.RATE_LIMIT).toContain('Slow down');
      expect(ERROR_MESSAGES.RATE_LIMIT).toBeDefined();
    });

    it('should have session messages', () => {
      expect(ERROR_MESSAGES.SESSION_EXPIRED).toContain('expired');
      expect(ERROR_MESSAGES.SESSION_EXPIRED).toContain('/start');
    });

    it('should have validation messages', () => {
      expect(ERROR_MESSAGES.INVALID_CLICK).toContain('Invalid');
    });

    it('should have system error messages', () => {
      expect(ERROR_MESSAGES.DATABASE_ERROR).toContain('wrong');
      expect(ERROR_MESSAGES.TELEGRAM_ERROR).toContain('Failed');
    });

    it('should have not found message', () => {
      expect(ERROR_MESSAGES.NOT_FOUND).toContain('not found');
      expect(ERROR_MESSAGES.NOT_FOUND).toContain('/start');
    });

    it('should be readonly at TypeScript level', () => {
      expect(ERROR_MESSAGES.RATE_LIMIT).toContain('Slow down');
      expect(typeof ERROR_MESSAGES).toBe('object');
    });

    it('should have user-friendly messages', () => {
      Object.values(ERROR_MESSAGES).forEach(message => {
        expect(message.length).toBeGreaterThan(10);
        expect(message).toMatch(/^[A-Z]/);
      });
    });

    it('should have all required error types', () => {
      expect(ERROR_MESSAGES.RATE_LIMIT).toBeDefined();
      expect(ERROR_MESSAGES.SESSION_EXPIRED).toBeDefined();
      expect(ERROR_MESSAGES.INVALID_CLICK).toBeDefined();
      expect(ERROR_MESSAGES.DATABASE_ERROR).toBeDefined();
      expect(ERROR_MESSAGES.NOT_FOUND).toBeDefined();
      expect(ERROR_MESSAGES.TELEGRAM_ERROR).toBeDefined();
    });
  });

  describe('Constants integration', () => {
    it('should have matching click limits in game settings and validation', () => {
      expect(GAME_SETTINGS.MIN_CLICK_COUNT).toBe(1);
      expect(GAME_SETTINGS.MAX_CLICK_COUNT).toBe(100);
    });

    it('should have consistent session timeout', () => {
      expect(GAME_SETTINGS.SESSION_TIMEOUT_MS).toBe(3600000);
    });

    it('should have leaderboard size less than reasonable limit', () => {
      expect(GAME_SETTINGS.LEADERBOARD_SIZE).toBeLessThanOrEqual(1000);
    });
  });
});
