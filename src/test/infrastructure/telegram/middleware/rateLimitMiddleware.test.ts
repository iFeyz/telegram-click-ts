import { rateLimitMiddleware } from '../../../../infrastructure/telegram/middleware/rateLimitMiddleware';
import { container } from '../../../../shared/container/DIContainer';
import { RateLimitError } from '../../../../shared/errors';
import type { BotContext } from '../../../../infrastructure/telegram/types';
import { logger } from '../../../../infrastructure/observability/logger';

jest.mock('../../../../shared/container/DIContainer');
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
    message: {
      text: '/start',
      message_id: 1,
      date: Date.now(),
    },
    ...overrides,
  } as unknown as BotContext;
};

describe('rateLimitMiddleware', () => {
  let mockRateLimiter: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRateLimiter = {
      checkRateLimit: jest.fn(),
      checkTelegramRateLimit: jest.fn(),
    };

    mockNext = jest.fn();

    (container.getRateLimiterRepository as jest.Mock).mockReturnValue(mockRateLimiter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('normal operation', () => {
    it('should proceed when rate limits are not exceeded', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 20,
        resetAt: new Date(Date.now() + 1000),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 15,
        resetAt: new Date(Date.now() + 1000),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should check global rate limit first', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith('global:telegram', 30, 1);
    });

    it('should check chat-specific rate limit', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockRateLimiter.checkTelegramRateLimit).toHaveBeenCalledWith('987654321', 20);
    });
  });

  describe('global rate limit', () => {
    it('should throw RateLimitError when global limit exceeded', async () => {
      const ctx = createMockContext();
      const resetAt = new Date(Date.now() + 5000);

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt,
      });

      await expect(rateLimitMiddleware(ctx, mockNext)).rejects.toThrow(RateLimitError);
      expect(mockNext).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.hit',
          limitType: 'global',
        }),
      );
    });

    it('should log warning when global limit is low', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 5,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.approaching',
          limitType: 'global',
          remaining: 5,
          max: 30,
        }),
      );
    });

    it('should not warn when global limit is at threshold (10)', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 10,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(logger.warn).not.toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.approaching',
        }),
      );
    });

    it('should include resetAt in thrown error', async () => {
      const ctx = createMockContext();
      const resetAt = new Date(Date.now() + 3000);

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt,
      });

      try {
        await rateLimitMiddleware(ctx, mockNext);
        fail('Should have thrown RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toEqual(resetAt);
      }
    });
  });

  describe('chat rate limit', () => {
    it('should throw RateLimitError when chat limit exceeded', async () => {
      const ctx = createMockContext();
      const resetAt = new Date(Date.now() + 2000);

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt,
      });

      await expect(rateLimitMiddleware(ctx, mockNext)).rejects.toThrow(RateLimitError);
      expect(mockNext).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.hit',
          limitType: 'chat',
        }),
      );
    });

    it('should log chat ID and user info on chat limit', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
      });

      try {
        await rateLimitMiddleware(ctx, mockNext);
      } catch (error) {
        // Expected
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.hit',
          limitType: 'chat',
          chatId: '987654321',
          username: 'testuser',
          userId: '123456789',
        }),
      );
    });
  });

  describe('bypass scenarios', () => {
    it('should skip rate limiting for non-message/non-callback updates', async () => {
      const ctx = createMockContext({
        message: undefined,
        callbackQuery: undefined,
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockRateLimiter.checkRateLimit).not.toHaveBeenCalled();
      expect(mockRateLimiter.checkTelegramRateLimit).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should skip rate limiting when userId is missing', async () => {
      const ctx = createMockContext({
        from: undefined,
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockRateLimiter.checkRateLimit).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should skip rate limiting when chat is missing', async () => {
      const ctx = createMockContext({
        chat: undefined,
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockRateLimiter.checkRateLimit).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should process callback queries', async () => {
      const ctx = createMockContext({
        message: undefined,
        callbackQuery: {
          data: 'some_data',
          id: 'callback-1',
        } as any,
      });

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('user identification', () => {
    it('should handle user without username', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456789,
          username: undefined,
          first_name: 'Test',
          is_bot: false,
        } as any,
      });

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
      });

      try {
        await rateLimitMiddleware(ctx, mockNext);
      } catch (error) {
        // Expected
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.hit',
          limitType: 'chat',
          username: 'unknown',
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 0 remaining in global limit', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
      });

      await expect(rateLimitMiddleware(ctx, mockNext)).rejects.toThrow(RateLimitError);
    });

    it('should handle concurrent requests', async () => {
      const ctx1 = createMockContext();
      const ctx2 = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await Promise.all([
        rateLimitMiddleware(ctx1, mockNext),
        rateLimitMiddleware(ctx2, mockNext),
      ]);

      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should handle rate limiter errors', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockRejectedValueOnce(new Error('Redis connection lost'));

      await expect(rateLimitMiddleware(ctx, mockNext)).rejects.toThrow('Redis connection lost');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should convert chat ID to string', async () => {
      const ctx = createMockContext({
        chat: { id: 999888777, type: 'private' } as any,
      });

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(mockRateLimiter.checkTelegramRateLimit).toHaveBeenCalledWith('999888777', 20);
    });
  });

  describe('integration scenarios', () => {
    it('should handle burst of requests with declining limits', async () => {
      const ctx = createMockContext();

      for (let i = 30; i > 0; i--) {
        mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
          allowed: i > 0,
          remaining: i - 1,
          resetAt: new Date(Date.now() + 1000),
        });

        mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
          allowed: true,
          remaining: 15,
          resetAt: new Date(Date.now() + 1000),
        });

        if (i > 0) {
          await rateLimitMiddleware(ctx, mockNext);
        }
      }

      expect(mockNext).toHaveBeenCalledTimes(30);
    });

    it('should stop processing once limit is hit', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
      });

      await expect(rateLimitMiddleware(ctx, mockNext)).rejects.toThrow(RateLimitError);

      expect(mockRateLimiter.checkTelegramRateLimit).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle different chat types', async () => {
      const groupCtx = createMockContext({
        chat: { id: 111222333, type: 'group' } as any,
      });

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 25,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(groupCtx, mockNext);

      expect(mockRateLimiter.checkTelegramRateLimit).toHaveBeenCalledWith('111222333', 20);
    });
  });

  describe('warning threshold behavior', () => {
    it('should warn at 9 remaining (below 10)', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 9,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.approaching',
          limitType: 'global',
          remaining: 9,
          max: 30,
        }),
      );
    });

    it('should warn at 1 remaining (critical)', async () => {
      const ctx = createMockContext();

      mockRateLimiter.checkRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 1,
        resetAt: new Date(),
      });

      mockRateLimiter.checkTelegramRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 18,
        resetAt: new Date(),
      });

      await rateLimitMiddleware(ctx, mockNext);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rate_limit.approaching',
          limitType: 'global',
          remaining: 1,
          max: 30,
        }),
      );
    });
  });
});
