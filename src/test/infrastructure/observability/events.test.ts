import {
  BotEvents,
  CommandNames,
  CallbackActions,
  CallbackToCommand,
  isClickAction,
  isLeaderboardAction,
  isStatsAction,
  parseCommandName,
} from '../../../infrastructure/observability/events';

describe('BotEvents', () => {
  describe('event constants', () => {
    it('should have bot lifecycle events', () => {
      expect(BotEvents.BOT_STARTED).toBe('bot.started');
      expect(BotEvents.BOT_STOPPED).toBe('bot.stopped');
      expect(BotEvents.BOT_ERROR).toBe('bot.error');
    });

    it('should have request/response events', () => {
      expect(BotEvents.REQUEST_RECEIVED).toBe('bot.request');
      expect(BotEvents.REQUEST_COMPLETED).toBe('bot.response');
      expect(BotEvents.REQUEST_FAILED).toBe('bot.request.failed');
    });

    it('should have user interaction events', () => {
      expect(BotEvents.USER_JOINED).toBe('user.joined');
      expect(BotEvents.USER_BLOCKED).toBe('user.blocked');
    });

    it('should have click events', () => {
      expect(BotEvents.CLICK_PERFORMED).toBe('click.performed');
      expect(BotEvents.CLICK_FAILED).toBe('click.failed');
    });

    it('should have leaderboard events', () => {
      expect(BotEvents.LEADERBOARD_VIEWED).toBe('leaderboard.viewed');
      expect(BotEvents.LEADERBOARD_LOADED).toBe('leaderboard.loaded');
    });

    it('should have stats events', () => {
      expect(BotEvents.STATS_VIEWED).toBe('stats.viewed');
      expect(BotEvents.STATS_CALCULATED).toBe('stats.calculated');
    });

    it('should have database events', () => {
      expect(BotEvents.DB_QUERY_SUCCESS).toBe('db.query.success');
      expect(BotEvents.DB_QUERY_FAILED).toBe('db.query.failed');
    });

    it('should have redis events', () => {
      expect(BotEvents.CACHE_HIT).toBe('cache.hit');
      expect(BotEvents.CACHE_MISS).toBe('cache.miss');
      expect(BotEvents.CACHE_SET).toBe('cache.set');
      expect(BotEvents.CACHE_DELETED).toBe('cache.deleted');
    });

    it('should have rate limit events', () => {
      expect(BotEvents.RATE_LIMIT_HIT).toBe('rate_limit.hit');
      expect(BotEvents.RATE_LIMIT_APPROACHING).toBe('rate_limit.approaching');
    });

    it('should follow naming convention', () => {
      const eventValues = Object.values(BotEvents);

      eventValues.forEach((event) => {
        expect(event).toMatch(/^[a-z_]+(\.[a-z_]+)+$/);
        expect(event).not.toMatch(/[A-Z]/);
        expect(event).not.toMatch(/\s/);
      });
    });
  });

  describe('CommandNames', () => {
    it('should have all command names', () => {
      expect(CommandNames.START).toBe('/start');
      expect(CommandNames.HELP).toBe('/help');
      expect(CommandNames.CLICK).toBe('click');
      expect(CommandNames.LEADERBOARD).toBe('leaderboard');
      expect(CommandNames.STATS).toBe('stats');
      expect(CommandNames.CHANGE_NAME).toBe('change_name');
      expect(CommandNames.UNKNOWN).toBe('unknown');
    });

    it('should use slash prefix for commands', () => {
      expect(CommandNames.START.startsWith('/')).toBe(true);
      expect(CommandNames.HELP.startsWith('/')).toBe(true);
    });

    it('should not use slash prefix for actions', () => {
      expect(CommandNames.CLICK.startsWith('/')).toBe(false);
      expect(CommandNames.LEADERBOARD.startsWith('/')).toBe(false);
      expect(CommandNames.STATS.startsWith('/')).toBe(false);
    });
  });

  describe('CallbackActions', () => {
    it('should have all callback actions', () => {
      expect(CallbackActions.CLICK).toBe('click');
      expect(CallbackActions.MENU).toBe('menu');
      expect(CallbackActions.LEADERBOARD).toBe('leaderboard');
      expect(CallbackActions.STATS).toBe('stats');
      expect(CallbackActions.CONFIRM).toBe('confirm');
      expect(CallbackActions.CANCEL).toBe('cancel');
    });

    it('should use lowercase names', () => {
      const actions = Object.values(CallbackActions);

      actions.forEach((action) => {
        expect(action).toBe(action.toLowerCase());
        expect(action).not.toMatch(/[A-Z]/);
      });
    });
  });

  describe('CallbackToCommand', () => {
    it('should map click to CLICK command', () => {
      expect(CallbackToCommand[CallbackActions.CLICK]).toBe(CommandNames.CLICK);
    });

    it('should map menu to START command', () => {
      expect(CallbackToCommand[CallbackActions.MENU]).toBe(CommandNames.START);
    });

    it('should map leaderboard to LEADERBOARD command', () => {
      expect(CallbackToCommand[CallbackActions.LEADERBOARD]).toBe(CommandNames.LEADERBOARD);
    });

    it('should map stats to STATS command', () => {
      expect(CallbackToCommand[CallbackActions.STATS]).toBe(CommandNames.STATS);
    });

    it('should have valid mappings', () => {
      const commandValues = Object.values(CommandNames);

      Object.values(CallbackToCommand).forEach((command) => {
        expect(commandValues).toContain(command);
      });
    });
  });
});

describe('isClickAction', () => {
  it('should return true for CLICK command', () => {
    expect(isClickAction(CommandNames.CLICK)).toBe(true);
  });

  it('should return true for click callback data', () => {
    expect(isClickAction('other', 'click')).toBe(true);
  });

  it('should return true for click callback with colon', () => {
    expect(isClickAction('other', 'action:click')).toBe(true);
    expect(isClickAction('other', 'user:123:click')).toBe(true);
  });

  it('should return false for non-click commands', () => {
    expect(isClickAction(CommandNames.START)).toBe(false);
    expect(isClickAction(CommandNames.LEADERBOARD)).toBe(false);
    expect(isClickAction(CommandNames.STATS)).toBe(false);
  });

  it('should return false for non-click callback data', () => {
    expect(isClickAction('other', 'menu')).toBe(false);
    expect(isClickAction('other', 'leaderboard')).toBe(false);
    expect(isClickAction('other', 'stats')).toBe(false);
  });

  it('should return false when callback data is undefined', () => {
    expect(isClickAction('other')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isClickAction('', '')).toBe(false);
    expect(isClickAction('click', undefined)).toBe(true);
    expect(isClickAction('', 'click')).toBe(true);
  });
});

describe('isLeaderboardAction', () => {
  it('should return true for LEADERBOARD command', () => {
    expect(isLeaderboardAction(CommandNames.LEADERBOARD)).toBe(true);
  });

  it('should return true for leaderboard callback data', () => {
    expect(isLeaderboardAction('other', 'leaderboard')).toBe(true);
  });

  it('should return true for leaderboard callback with colon', () => {
    expect(isLeaderboardAction('other', 'leaderboard:page:1')).toBe(true);
    expect(isLeaderboardAction('other', 'action:leaderboard')).toBe(true);
  });

  it('should return false for non-leaderboard commands', () => {
    expect(isLeaderboardAction(CommandNames.CLICK)).toBe(false);
    expect(isLeaderboardAction(CommandNames.START)).toBe(false);
    expect(isLeaderboardAction(CommandNames.STATS)).toBe(false);
  });

  it('should return false for non-leaderboard callback data', () => {
    expect(isLeaderboardAction('other', 'click')).toBe(false);
    expect(isLeaderboardAction('other', 'menu')).toBe(false);
    expect(isLeaderboardAction('other', 'stats')).toBe(false);
  });

  it('should return false when callback data is undefined', () => {
    expect(isLeaderboardAction('other')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isLeaderboardAction('', '')).toBe(false);
    expect(isLeaderboardAction('leaderboard', undefined)).toBe(true);
    expect(isLeaderboardAction('', 'leaderboard')).toBe(true);
  });
});

describe('isStatsAction', () => {
  it('should return true for STATS command', () => {
    expect(isStatsAction(CommandNames.STATS)).toBe(true);
  });

  it('should return true for stats callback data', () => {
    expect(isStatsAction('other', 'stats')).toBe(true);
  });

  it('should return true for stats callback with colon', () => {
    expect(isStatsAction('other', 'stats:user')).toBe(true);
    expect(isStatsAction('other', 'action:stats')).toBe(true);
  });

  it('should return false for non-stats commands', () => {
    expect(isStatsAction(CommandNames.CLICK)).toBe(false);
    expect(isStatsAction(CommandNames.START)).toBe(false);
    expect(isStatsAction(CommandNames.LEADERBOARD)).toBe(false);
  });

  it('should return false for non-stats callback data', () => {
    expect(isStatsAction('other', 'click')).toBe(false);
    expect(isStatsAction('other', 'menu')).toBe(false);
    expect(isStatsAction('other', 'leaderboard')).toBe(false);
  });

  it('should return false when callback data is undefined', () => {
    expect(isStatsAction('other')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isStatsAction('', '')).toBe(false);
    expect(isStatsAction('stats', undefined)).toBe(true);
    expect(isStatsAction('', 'stats')).toBe(true);
  });
});

describe('parseCommandName', () => {
  describe('text commands', () => {
    it('should parse /start command', () => {
      expect(parseCommandName('/start')).toBe('/start');
    });

    it('should parse /help command', () => {
      expect(parseCommandName('/help')).toBe('/help');
    });

    it('should parse command with arguments', () => {
      expect(parseCommandName('/start ref123')).toBe('/start');
      expect(parseCommandName('/help topic')).toBe('/help');
    });

    it('should handle command without slash', () => {
      expect(parseCommandName('start')).toBe('start');
      expect(parseCommandName('help')).toBe('help');
    });

    it('should handle empty message text', () => {
      expect(parseCommandName('')).toBe(CommandNames.UNKNOWN);
    });
  });

  describe('callback queries', () => {
    it('should parse simple callback actions', () => {
      expect(parseCommandName(undefined, 'click')).toBe(CommandNames.CLICK);
      expect(parseCommandName(undefined, 'menu')).toBe(CommandNames.START);
      expect(parseCommandName(undefined, 'leaderboard')).toBe(CommandNames.LEADERBOARD);
      expect(parseCommandName(undefined, 'stats')).toBe(CommandNames.STATS);
    });

    it('should parse callback with colon separator', () => {
      expect(parseCommandName(undefined, 'click:user:123')).toBe(CommandNames.CLICK);
      expect(parseCommandName(undefined, 'leaderboard:page:1')).toBe(CommandNames.LEADERBOARD);
      expect(parseCommandName(undefined, 'stats:daily')).toBe(CommandNames.STATS);
    });

    it('should handle unknown callbacks', () => {
      expect(parseCommandName(undefined, 'unknown_action')).toBe('unknown_action');
      expect(parseCommandName(undefined, 'custom:action')).toBe('callback:custom');
    });

    it('should handle empty callback data', () => {
      expect(parseCommandName(undefined, '')).toBe(CommandNames.UNKNOWN);
    });
  });

  describe('priority', () => {
    it('should prioritize message text over callback data', () => {
      expect(parseCommandName('/start', 'click')).toBe('/start');
      expect(parseCommandName('/help', 'leaderboard')).toBe('/help');
    });
  });

  describe('edge cases', () => {
    it('should return UNKNOWN when both are undefined', () => {
      expect(parseCommandName()).toBe(CommandNames.UNKNOWN);
      expect(parseCommandName(undefined, undefined)).toBe(CommandNames.UNKNOWN);
    });

    it('should handle whitespace', () => {
      expect(parseCommandName('   ')).toBe(CommandNames.UNKNOWN);
      expect(parseCommandName('/start   ')).toBe('/start');
    });

    it('should handle special characters', () => {
      expect(parseCommandName('/start@botname')).toBe('/start@botname');
    });

    it('should handle callback with only colons', () => {
      expect(parseCommandName(undefined, ':::')).toBe(CommandNames.UNKNOWN);
    });

    it('should handle very long callback data', () => {
      const longCallback = 'action:' + 'x'.repeat(1000);
      expect(parseCommandName(undefined, longCallback)).toBe('callback:action');
    });

    it('should handle callback with trailing colon', () => {
      expect(parseCommandName(undefined, 'click:')).toBe(CommandNames.CLICK);
    });

    it('should handle callback with leading colon', () => {
      expect(parseCommandName(undefined, ':click')).toBe(CommandNames.UNKNOWN);
    });
  });

  describe('consistency', () => {
    it('should be idempotent for commands', () => {
      const command = '/start';
      expect(parseCommandName(command)).toBe(parseCommandName(command));
    });

    it('should be idempotent for callbacks', () => {
      const callback = 'click:user:123';
      expect(parseCommandName(undefined, callback)).toBe(parseCommandName(undefined, callback));
    });
  });
});
