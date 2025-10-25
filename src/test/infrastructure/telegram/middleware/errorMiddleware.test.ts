import { errorMiddleware } from '../../../../infrastructure/telegram/middleware/errorMiddleware';
import {
  RateLimitError,
  SessionExpiredError,
  InvalidSessionError,
  UserNotFoundError,
  DatabaseError,
  RedisError,
  ValidationError,
  TelegramApiError,
} from '../../../../shared/errors';
import type { BotContext } from '../../../../infrastructure/telegram/types';
import { User } from '../../../../domain/entities/User';
import { Session } from '../../../../domain/entities/Session';

const createMockContext = (): BotContext => {
  return {
    from: {
      id: 123456789,
      first_name: 'Test',
      is_bot: false,
    },
    session: {
      user: new User({
        id: 'user-1',
        telegramId: BigInt(123456789),
        firstName: 'Test',
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      session: new Session({
        userId: 'user-1',
        telegramId: BigInt(123456789),
      }),
    },
    reply: jest.fn(),
  } as unknown as BotContext;
};

describe('errorMiddleware', () => {
  let mockNext: jest.Mock;
  let mockContext: BotContext;

  beforeEach(() => {
    mockNext = jest.fn();
    mockContext = createMockContext();
    jest.clearAllMocks();
  });

  describe('error-free execution', () => {
    it('should call next and complete successfully', async () => {
      await errorMiddleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockContext.reply).not.toHaveBeenCalled();
    });

    it('should not interfere with normal flow', async () => {
      mockNext.mockImplementation(async () => {
        mockContext.session.user = new User({
          id: 'user-2',
          telegramId: BigInt(987654321),
          firstName: 'Changed',
          score: BigInt(100),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.session.user?.id).toBe('user-2');
    });
  });

  describe('error handling - RateLimitError', () => {
    it('should handle RateLimitError with warning log', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const retryAfter = new Date(Date.now() + 5000);

      mockNext.mockRejectedValueOnce(new RateLimitError(retryAfter));

      await errorMiddleware(mockContext, mockNext);

      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN]', expect.any(String));
      expect(mockContext.reply).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should send rate limit message to user', async () => {
      jest.spyOn(console, 'warn').mockImplementation();
      const retryAfter = new Date(Date.now() + 3000);

      mockNext.mockRejectedValueOnce(new RateLimitError(retryAfter));

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Rate Limit'),
        { parse_mode: 'HTML' },
      );

      jest.restoreAllMocks();
    });
  });

  describe('error handling - SessionExpiredError', () => {
    it('should clear session on SessionExpiredError', async () => {
      jest.spyOn(console, 'info').mockImplementation();

      mockNext.mockRejectedValueOnce(new SessionExpiredError());

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.session.user).toBeUndefined();
      expect(mockContext.session.session).toBeUndefined();

      jest.restoreAllMocks();
    });

    it('should log info level for SessionExpiredError', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      mockNext.mockRejectedValueOnce(new SessionExpiredError());

      await errorMiddleware(mockContext, mockNext);

      expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO]', expect.any(String));

      consoleInfoSpy.mockRestore();
    });
  });

  describe('error handling - InvalidSessionError', () => {
    it('should clear session on InvalidSessionError', async () => {
      jest.spyOn(console, 'warn').mockImplementation();

      mockNext.mockRejectedValueOnce(new InvalidSessionError());

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.session.user).toBeUndefined();
      expect(mockContext.session.session).toBeUndefined();

      jest.restoreAllMocks();
    });
  });

  describe('error handling - DatabaseError', () => {
    it('should log error level for DatabaseError', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce(new DatabaseError('Connection failed'));

      await errorMiddleware(mockContext, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', expect.any(DatabaseError));

      consoleErrorSpy.mockRestore();
    });

    it('should send user-friendly message for DatabaseError', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce(new DatabaseError('Connection timeout'));

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Something went wrong'),
        { parse_mode: 'HTML' },
      );

      jest.restoreAllMocks();
    });
  });

  describe('error handling - RedisError', () => {
    it('should handle RedisError gracefully', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce(new RedisError('Redis connection lost'));

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('service issue'),
        { parse_mode: 'HTML' },
      );

      jest.restoreAllMocks();
    });
  });

  describe('error handling - ValidationError', () => {
    it('should handle ValidationError with field details', async () => {
      jest.spyOn(console, 'warn').mockImplementation();

      mockNext.mockRejectedValueOnce(
        new ValidationError({ count: 'Must be between 1 and 100' }),
      );

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('count'),
        { parse_mode: 'HTML' },
      );

      jest.restoreAllMocks();
    });
  });

  describe('error handling - TelegramApiError', () => {
    it('should handle 429 TelegramApiError', async () => {
      jest.spyOn(console, 'warn').mockImplementation();

      mockNext.mockRejectedValueOnce(new TelegramApiError(429, 'Too Many Requests'));

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('Telegram Rate Limit'),
        { parse_mode: 'HTML' },
      );

      jest.restoreAllMocks();
    });

    it('should handle other TelegramApiError codes', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce(new TelegramApiError(403, 'Forbidden'));

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });

  describe('error handling - UserNotFoundError', () => {
    it('should handle UserNotFoundError', async () => {
      jest.spyOn(console, 'info').mockImplementation();

      mockNext.mockRejectedValueOnce(new UserNotFoundError('user-123'));

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
        { parse_mode: 'HTML' },
      );

      jest.restoreAllMocks();
    });
  });

  describe('error handling - generic errors', () => {
    it('should handle generic Error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce(new Error('Unknown error'));

      await errorMiddleware(mockContext, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', expect.any(Error));
      expect(mockContext.reply).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error objects', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce({ message: 'Something broke' });

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should handle string errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce('String error');

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });

  describe('reply failure handling', () => {
    it('should handle reply failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockContext.reply = jest.fn().mockRejectedValueOnce(new Error('Reply failed'));

      mockNext.mockRejectedValueOnce(new DatabaseError('Test error'));

      await errorMiddleware(mockContext, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ERROR] Failed to send error message:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should log original error even if reply fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockContext.reply = jest.fn().mockRejectedValueOnce(new Error('Reply failed'));

      const originalError = new DatabaseError('Original error');
      mockNext.mockRejectedValueOnce(originalError);

      await errorMiddleware(mockContext, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', originalError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('session clearing logic', () => {
    it('should not clear session for errors that do not require it', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      const originalUser = mockContext.session.user;
      const originalSession = mockContext.session.session;

      mockNext.mockRejectedValueOnce(new DatabaseError('Test'));

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.session.user).toBe(originalUser);
      expect(mockContext.session.session).toBe(originalSession);

      jest.restoreAllMocks();
    });

    it('should clear both user and session together', async () => {
      jest.spyOn(console, 'info').mockImplementation();

      mockNext.mockRejectedValueOnce(new SessionExpiredError());

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.session.user).toBeUndefined();
      expect(mockContext.session.session).toBeUndefined();

      jest.restoreAllMocks();
    });
  });

  describe('logging levels', () => {
    it('should use error level for DatabaseError', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce(new DatabaseError('Test'));

      await errorMiddleware(mockContext, mockNext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', expect.any(DatabaseError));

      consoleErrorSpy.mockRestore();
    });

    it('should use warn level for RateLimitError', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockNext.mockRejectedValueOnce(new RateLimitError(new Date()));

      await errorMiddleware(mockContext, mockNext);

      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN]', expect.any(String));

      consoleWarnSpy.mockRestore();
    });

    it('should use info level for SessionExpiredError', async () => {
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

      mockNext.mockRejectedValueOnce(new SessionExpiredError());

      await errorMiddleware(mockContext, mockNext);

      expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO]', expect.any(String));

      consoleInfoSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle errors thrown synchronously in next', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockImplementation(() => {
        throw new Error('Sync error');
      });

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should handle null/undefined errors', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      mockNext.mockRejectedValueOnce(null);

      await errorMiddleware(mockContext, mockNext);

      expect(mockContext.reply).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should preserve error handling order', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const order: string[] = [];

      mockNext.mockRejectedValueOnce(new RateLimitError(new Date()));
      mockContext.reply = jest.fn().mockImplementation(() => {
        order.push('reply');
        return Promise.resolve();
      });

      consoleWarnSpy.mockImplementation(() => {
        order.push('log');
      });

      await errorMiddleware(mockContext, mockNext);

      expect(order).toEqual(['log', 'reply']);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple errors in sequence', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();

      mockNext.mockRejectedValueOnce(new DatabaseError('First error'));
      await errorMiddleware(mockContext, mockNext);

      mockNext.mockRejectedValueOnce(new RateLimitError(new Date()));
      await errorMiddleware(createMockContext(), mockNext);

      expect(mockContext.reply).toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should handle errors without session data', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      const ctxWithoutSession = {
        from: { id: 123456789, first_name: 'Test', is_bot: false },
        session: { user: undefined, session: undefined },
        reply: jest.fn(),
      } as unknown as BotContext;

      mockNext.mockRejectedValueOnce(new DatabaseError('Test'));

      await errorMiddleware(ctxWithoutSession, mockNext);

      expect(ctxWithoutSession.reply).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});
