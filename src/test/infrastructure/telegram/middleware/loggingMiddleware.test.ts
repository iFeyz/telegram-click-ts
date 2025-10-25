import { loggingMiddleware } from '../../../../infrastructure/telegram/middleware/loggingMiddleware';
import type { BotContext } from '../../../../infrastructure/telegram/types';

const createMockContext = (overrides: Partial<BotContext> = {}): BotContext => {
  return {
    from: {
      id: 123456789,
      username: 'testuser',
      first_name: 'Test',
      is_bot: false,
    },
    chat: {
      id: 987654321,
      type: 'private',
    },
    ...overrides,
  } as unknown as BotContext;
};

describe('loggingMiddleware', () => {
  let mockNext: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockNext = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('basic logging', () => {
    it('should log request start with username', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Update from testuser in private/),
      );
    });

    it('should log request start with user ID when no username', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456789,
          username: undefined,
          first_name: 'Test',
          is_bot: false,
        } as any,
      });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Update from 123456789 in private/),
      );
    });

    it('should log request completion with duration', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Processed in \d+ms/),
      );
    });

    it('should call next middleware', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should include ISO timestamp in logs', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      const calls = consoleLogSpy.mock.calls;
      expect(calls[0][0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(calls[1][0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('chat types', () => {
    it('should log private chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'private' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('in private'),
      );
    });

    it('should log group chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'group' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('in group'),
      );
    });

    it('should log supergroup chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'supergroup' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('in supergroup'),
      );
    });

    it('should log channel chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'channel' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('in channel'),
      );
    });
  });

  describe('timing', () => {
    it('should measure execution time accurately', async () => {
      const ctx = createMockContext();

      mockNext.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await loggingMiddleware(ctx, mockNext);

      const durationLog = consoleLogSpy.mock.calls[1][0];
      const match = durationLog.match(/Processed in (\d+)ms/);

      if (!match) {
        console.log('Duration log:', durationLog);
      }

      expect(match).not.toBeNull();
      const duration = parseInt(match![1], 10);
      expect(duration).toBeGreaterThanOrEqual(40);
    });

    it('should log fast operations correctly', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      const durationLog = consoleLogSpy.mock.calls[1][0];
      expect(durationLog).toMatch(/Processed in \d+ms/);
    });

    it('should handle synchronous next function', async () => {
      const ctx = createMockContext();

      mockNext.mockImplementation(() => {
        // Synchronous operation
      });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle missing from field', async () => {
      const ctx = createMockContext({ from: undefined });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Update from undefined/),
      );
    });

    it('should handle missing chat field', async () => {
      const ctx = createMockContext({ chat: undefined });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Update from testuser in undefined/),
      );
    });

    it('should log even when next throws error', async () => {
      const ctx = createMockContext();
      const error = new Error('Next failed');

      mockNext.mockRejectedValueOnce(error);

      await expect(loggingMiddleware(ctx, mockNext)).rejects.toThrow(error);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Update from testuser/),
      );
    });

    it('should handle very long usernames', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456789,
          username: 'a'.repeat(100),
          first_name: 'Test',
          is_bot: false,
        } as any,
      });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('a'.repeat(100)),
      );
    });

    it('should handle special characters in username', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456789,
          username: 'test_user-123',
          first_name: 'Test',
          is_bot: false,
        } as any,
      });

      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('test_user-123'),
      );
    });
  });

  describe('logging order', () => {
    it('should log start before calling next', async () => {
      const ctx = createMockContext();
      const order: string[] = [];

      consoleLogSpy.mockImplementation((msg) => {
        order.push(msg.includes('Update from') ? 'start' : 'end');
      });

      mockNext.mockImplementation(() => {
        order.push('next');
        return Promise.resolve();
      });

      await loggingMiddleware(ctx, mockNext);

      expect(order).toEqual(['start', 'next', 'end']);
    });

    it('should log end after next completes', async () => {
      const ctx = createMockContext();
      let nextCalled = false;

      mockNext.mockImplementation(async () => {
        nextCalled = true;
      });

      await loggingMiddleware(ctx, mockNext);

      expect(nextCalled).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrent requests', () => {
    it('should log concurrent requests independently', async () => {
      const ctx1 = createMockContext();
      const ctx2 = createMockContext({
        from: { id: 999, username: 'other_user', first_name: 'Other', is_bot: false } as any,
      });

      await Promise.all([
        loggingMiddleware(ctx1, mockNext),
        loggingMiddleware(ctx2, mockNext),
      ]);

      expect(consoleLogSpy).toHaveBeenCalledTimes(4);

      const logs = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(logs.some((log) => log.includes('testuser'))).toBe(true);
      expect(logs.some((log) => log.includes('other_user'))).toBe(true);
    });
  });

  describe('performance', () => {
    it('should have minimal overhead for fast operations', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      const durationLog = consoleLogSpy.mock.calls[1][0];
      const match = durationLog.match(/Processed in (\d+)ms/);
      const duration = parseInt(match![1], 10);

      expect(duration).toBeLessThan(100);
    });

    it('should accurately measure slow operations', async () => {
      const ctx = createMockContext();
      const delay = 100;

      mockNext.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, delay)));

      await loggingMiddleware(ctx, mockNext);

      const durationLog = consoleLogSpy.mock.calls[1][0];
      const match = durationLog.match(/Processed in (\d+)ms/);
      const duration = parseInt(match![1], 10);

      expect(duration).toBeGreaterThanOrEqual(delay - 10);
      expect(duration).toBeLessThan(delay + 50);
    });
  });

  describe('integration', () => {
    it('should work with multiple middleware calls', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);
      await loggingMiddleware(ctx, mockNext);
      await loggingMiddleware(ctx, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledTimes(6);
      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid successive calls', async () => {
      const ctx = createMockContext();
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(loggingMiddleware(ctx, mockNext));
      }

      await Promise.all(promises);

      expect(consoleLogSpy).toHaveBeenCalledTimes(20);
    });
  });
});
