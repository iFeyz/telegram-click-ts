import { ErrorHandlerRegistry } from '../../../application/errors/ErrorHandlerRegistry';
import {
  RateLimitError,
  SessionExpiredError,
  InvalidSessionError,
  UserNotFoundError,
  DatabaseError,
  RedisError,
  ValidationError,
  TelegramApiError,
} from '../../../shared/errors';
import type { BotContext } from '../../../infrastructure/telegram/types';

const createMockContext = (): BotContext => {
  return {
    from: {
      id: 123456,
      first_name: 'Test',
      is_bot: false,
    },
    session: {
      user: undefined,
      session: undefined,
    },
    reply: jest.fn(),
  } as unknown as BotContext;
};

describe('ErrorHandlerRegistry', () => {
  let registry: ErrorHandlerRegistry;
  let mockContext: BotContext;

  beforeEach(() => {
    registry = new ErrorHandlerRegistry();
    mockContext = createMockContext();
  });

  describe('initialization', () => {
    it('should initialize with default handlers', () => {
      expect(registry).toBeDefined();
    });
  });

  describe('handle - RateLimitError', () => {
    it('should handle RateLimitError', async () => {
      const retryAfter = new Date(Date.now() + 5000);
      const error = new RateLimitError(retryAfter);

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('warn');
      expect(response.message).toContain('Rate Limit Exceeded');
      expect(response.message).toContain('second');
    });

    it('should calculate wait time correctly', async () => {
      const retryAfter = new Date(Date.now() + 3000);
      const error = new RateLimitError(retryAfter);

      const response = await registry.handle(error, mockContext);

      expect(response.message).toContain('3 second');
    });
  });

  describe('handle - SessionExpiredError', () => {
    it('should handle SessionExpiredError', async () => {
      const error = new SessionExpiredError();

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('info');
      expect(response.message).toContain('expired');
      expect(response.message).toContain('/start');
      expect(response.shouldClearSession).toBe(true);
    });
  });

  describe('handle - InvalidSessionError', () => {
    it('should handle InvalidSessionError', async () => {
      const error = new InvalidSessionError();

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('warn');
      expect(response.message).toContain('Invalid');
      expect(response.message).toContain('/start');
      expect(response.shouldClearSession).toBe(true);
    });
  });

  describe('handle - TelegramApiError', () => {
    it('should handle TelegramApiError with 429 status', async () => {
      const error = new TelegramApiError(429, 'Too Many Requests');

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('warn');
      expect(response.message).toContain('Telegram Rate Limit');
      expect(response.message).toContain('high traffic');
    });

    it('should handle TelegramApiError with 403 status', async () => {
      const error = new TelegramApiError(403, 'Forbidden');

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
      expect(response.message).toContain('Failed to send message');
      expect(response.message).toContain('403');
    });

    it('should handle generic TelegramApiError', async () => {
      const error = new TelegramApiError(500, 'Internal Server Error');

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
      expect(response.message).toContain('500');
    });
  });

  describe('handle - UserNotFoundError', () => {
    it('should handle UserNotFoundError', async () => {
      const error = new UserNotFoundError('user-123');

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('info');
      expect(response.message).toContain('not found');
      expect(response.message).toContain('/start');
    });
  });

  describe('handle - DatabaseError', () => {
    it('should handle DatabaseError', async () => {
      const error = new DatabaseError('Connection failed');

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
      expect(response.message).toContain('Something went wrong');
      expect(response.message).toContain('try again later');
    });

    it('should handle DatabaseError with original error', async () => {
      const originalError = new Error('Connection timeout');
      const error = new DatabaseError('Failed', originalError);

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
      expect(response.message).toContain('notified');
    });
  });

  describe('handle - RedisError', () => {
    it('should handle RedisError', async () => {
      const error = new RedisError('Connection timeout');

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
      expect(response.message).toContain('Temporary service issue');
      expect(response.message).toContain('try again in a moment');
    });
  });

  describe('handle - ValidationError', () => {
    it('should handle ValidationError with single field', async () => {
      const error = new ValidationError({ count: 'Must be an integer' });

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('warn');
      expect(response.message).toContain('count');
      expect(response.message).toContain('Must be an integer');
    });

    it('should handle ValidationError with multiple fields', async () => {
      const error = new ValidationError({
        email: 'Invalid email',
        password: 'Too short',
      });

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.message).toContain('email');
      expect(response.message).toContain('password');
    });
  });

  describe('handle - unknown errors', () => {
    it('should handle unknown error type with fallback', async () => {
      const error = new Error('Unknown error');

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
      expect(response.message).toContain('Unexpected Error');
      expect(response.message).toContain('notified');
    });

    it('should handle non-Error objects', async () => {
      const error = { message: 'Something went wrong' };

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
    });

    it('should handle string errors', async () => {
      const error = 'String error message';

      const response = await registry.handle(error, mockContext);

      expect(response.shouldReply).toBe(true);
      expect(response.logLevel).toBe('error');
    });

    it('should handle null/undefined', async () => {
      const response1 = await registry.handle(null, mockContext);
      const response2 = await registry.handle(undefined, mockContext);

      expect(response1.shouldReply).toBe(true);
      expect(response2.shouldReply).toBe(true);
    });
  });

  describe('handler priority', () => {
    it('should use first matching handler', async () => {
      const error = new RateLimitError(new Date());

      const response = await registry.handle(error, mockContext);

      expect(response.message).toContain('Rate Limit');
    });
  });

  describe('custom handler registration', () => {
    it('should allow registering custom handlers', () => {
      const customHandler = {
        canHandle: (error: unknown) => error instanceof TypeError,
        handle: async () => ({
          message: 'Custom handler',
          shouldReply: true,
          logLevel: 'info' as const,
        }),
      };

      registry.register(customHandler);

      expect(registry).toBeDefined();
    });
  });

  describe('response structure', () => {
    it('should return complete ErrorResponse', async () => {
      const error = new SessionExpiredError();

      const response = await registry.handle(error, mockContext);

      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('shouldReply');
      expect(response).toHaveProperty('logLevel');
      expect(typeof response.message).toBe('string');
      expect(typeof response.shouldReply).toBe('boolean');
      expect(['error', 'warn', 'info']).toContain(response.logLevel);
    });
  });

  describe('edge cases', () => {
    it('should handle errors with very long messages', async () => {
      const longMessage = 'A'.repeat(10000);
      const error = new DatabaseError(longMessage);

      const response = await registry.handle(error, mockContext);

      expect(response).toBeDefined();
      expect(response.shouldReply).toBe(true);
    });

    it('should handle concurrent error handling', async () => {
      const errors = [
        new RateLimitError(new Date(Date.now() + 1000)),
        new SessionExpiredError(),
        new ValidationError({ field: 'error' }),
      ];

      const responses = await Promise.all(
        errors.map((error) => registry.handle(error, mockContext)),
      );

      expect(responses).toHaveLength(3);
      expect(responses.every((r) => r.shouldReply !== undefined)).toBe(true);
    });
  });
});
