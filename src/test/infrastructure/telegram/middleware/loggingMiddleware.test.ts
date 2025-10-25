import { loggingMiddleware } from '../../../../infrastructure/telegram/middleware/loggingMiddleware';
import type { BotContext } from '../../../../infrastructure/telegram/types';
import { logger } from '../../../../infrastructure/observability/logger';

jest.mock('../../../../infrastructure/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  },
}));

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

  beforeEach(() => {
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('basic logging', () => {
    it('should log request start with username', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123456789,
          username: 'testuser',
          chatType: 'private',
        }),
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

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123456789,
          username: undefined,
          chatType: 'private',
        }),
      );
    });

    it('should log request completion', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'bot.response',
          duration: expect.any(Number),
          success: true,
        }),
      );
    });

    it('should call next middleware', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should log with event information', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'bot.request',
        }),
      );
    });
  });

  describe('chat types', () => {
    it('should log private chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'private' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: 'private',
        }),
      );
    });

    it('should log group chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'group' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: 'group',
        }),
      );
    });

    it('should log supergroup chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'supergroup' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: 'supergroup',
        }),
      );
    });

    it('should log channel chat type', async () => {
      const ctx = createMockContext({ chat: { id: 123, type: 'channel' } as any });

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          chatType: 'channel',
        }),
      );
    });
  });



  describe('edge cases', () => {
    it('should handle missing from field', async () => {
      const ctx = createMockContext({ from: undefined });

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          username: undefined,
        }),
      );
    });

    it('should handle missing chat field', async () => {
      const ctx = createMockContext({ chat: undefined });

      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          chatType: undefined,
        }),
      );
    });

    it('should log even when next throws error', async () => {
      const ctx = createMockContext();
      const error = new Error('Next failed');

      mockNext.mockRejectedValueOnce(error);

      await expect(loggingMiddleware(ctx, mockNext)).rejects.toThrow(error);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'bot.request',
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'bot.response',
          success: false,
        }),
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

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'a'.repeat(100),
        }),
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

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'test_user-123',
        }),
      );
    });
  });

  describe('logging order', () => {
    it('should log start before calling next', async () => {
      const ctx = createMockContext();
      const order: string[] = [];

      (logger.info as jest.Mock).mockImplementation((msg: any) => {
        if (msg.event === 'bot.request') {
          order.push('start');
        } else if (msg.event === 'bot.response') {
          order.push('end');
        }
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
      expect(logger.info).toHaveBeenCalled();
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

      expect(logger.info).toHaveBeenCalled();

      const calls = (logger.info as jest.Mock).mock.calls;
      const hasTestuser = calls.some((call: any) => call[0]?.username === 'testuser');
      const hasOtherUser = calls.some((call: any) => call[0]?.username === 'other_user');

      expect(hasTestuser).toBe(true);
      expect(hasOtherUser).toBe(true);
    });
  });



  describe('integration', () => {
    it('should work with multiple middleware calls', async () => {
      const ctx = createMockContext();

      await loggingMiddleware(ctx, mockNext);
      await loggingMiddleware(ctx, mockNext);
      await loggingMiddleware(ctx, mockNext);

      expect(logger.info).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid successive calls', async () => {
      const ctx = createMockContext();
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(loggingMiddleware(ctx, mockNext));
      }

      await Promise.all(promises);

      expect(logger.info).toHaveBeenCalled();
    });
  });
});
