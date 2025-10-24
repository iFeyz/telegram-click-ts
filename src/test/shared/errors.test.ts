import {
  DomainError,
  UserNotFoundError,
  SessionExpiredError,
  InvalidSessionError,
  RateLimitError,
  InvalidClickError,
  TelegramApiError,
  DatabaseError,
  RedisError,
  ValidationError,
} from '../../shared/errors';

describe('Shared Errors', () => {
  describe('DomainError', () => {
    it('should create error with message and code', () => {
      const error = new DomainError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('DomainError');
    });

    it('should be instance of Error', () => {
      const error = new DomainError('Test', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('UserNotFoundError', () => {
    it('should create error with user identifier', () => {
      const error = new UserNotFoundError('user-123');

      expect(error.message).toBe('User not found: user-123');
      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.name).toBe('UserNotFoundError');
    });

    it('should be instance of DomainError', () => {
      const error = new UserNotFoundError('test');
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should handle different identifier types', () => {
      const error1 = new UserNotFoundError('email@test.com');
      const error2 = new UserNotFoundError('123456');

      expect(error1.message).toContain('email@test.com');
      expect(error2.message).toContain('123456');
    });
  });

  describe('SessionExpiredError', () => {
    it('should create error with default message', () => {
      const error = new SessionExpiredError();

      expect(error.message).toBe('Session has expired');
      expect(error.code).toBe('SESSION_EXPIRED');
      expect(error.name).toBe('SessionExpiredError');
    });

    it('should be instance of DomainError', () => {
      const error = new SessionExpiredError();
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('InvalidSessionError', () => {
    it('should create error with default message', () => {
      const error = new InvalidSessionError();

      expect(error.message).toBe('Invalid session token');
      expect(error.code).toBe('INVALID_SESSION');
      expect(error.name).toBe('InvalidSessionError');
    });

    it('should be instance of DomainError', () => {
      const error = new InvalidSessionError();
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('RateLimitError', () => {
    it('should create error with retry time', () => {
      const retryAfter = new Date(Date.now() + 5000);
      const error = new RateLimitError(retryAfter);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.name).toBe('RateLimitError');
      expect(error.retryAfter).toBe(retryAfter);
    });

    it('should be instance of DomainError', () => {
      const error = new RateLimitError(new Date());
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should store retryAfter as Date', () => {
      const retryAfter = new Date('2024-12-31T23:59:59Z');
      const error = new RateLimitError(retryAfter);

      expect(error.retryAfter).toBeInstanceOf(Date);
      expect(error.retryAfter.toISOString()).toBe('2024-12-31T23:59:59.000Z');
    });
  });

  describe('InvalidClickError', () => {
    it('should create error with reason', () => {
      const error = new InvalidClickError('Click count too high');

      expect(error.message).toBe('Invalid click: Click count too high');
      expect(error.code).toBe('INVALID_CLICK');
      expect(error.name).toBe('InvalidClickError');
    });

    it('should be instance of DomainError', () => {
      const error = new InvalidClickError('test');
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should handle different reasons', () => {
      const error1 = new InvalidClickError('Negative value');
      const error2 = new InvalidClickError('Non-integer');

      expect(error1.message).toContain('Negative value');
      expect(error2.message).toContain('Non-integer');
    });
  });

  describe('TelegramApiError', () => {
    it('should create error with code and description', () => {
      const error = new TelegramApiError(429, 'Too Many Requests');

      expect(error.message).toBe('Telegram API error 429: Too Many Requests');
      expect(error.errorCode).toBe(429);
      expect(error.description).toBe('Too Many Requests');
      expect(error.name).toBe('TelegramApiError');
    });

    it('should be instance of Error', () => {
      const error = new TelegramApiError(400, 'Bad Request');
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle different error codes', () => {
      const error400 = new TelegramApiError(400, 'Bad Request');
      const error403 = new TelegramApiError(403, 'Forbidden');
      const error404 = new TelegramApiError(404, 'Not Found');

      expect(error400.errorCode).toBe(400);
      expect(error403.errorCode).toBe(403);
      expect(error404.errorCode).toBe(404);
    });
  });

  describe('DatabaseError', () => {
    it('should create error with message', () => {
      const error = new DatabaseError('Connection failed');

      expect(error.message).toBe('Database error: Connection failed');
      expect(error.name).toBe('DatabaseError');
      expect(error.originalError).toBeUndefined();
    });

    it('should store original error if provided', () => {
      const originalError = new Error('Original error');
      const error = new DatabaseError('Wrapper error', originalError);

      expect(error.originalError).toBe(originalError);
      expect(error.originalError?.message).toBe('Original error');
    });

    it('should be instance of Error', () => {
      const error = new DatabaseError('test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('RedisError', () => {
    it('should create error with message', () => {
      const error = new RedisError('Connection timeout');

      expect(error.message).toBe('Redis error: Connection timeout');
      expect(error.name).toBe('RedisError');
      expect(error.originalError).toBeUndefined();
    });

    it('should store original error if provided', () => {
      const originalError = new Error('Network error');
      const error = new RedisError('Redis failed', originalError);

      expect(error.originalError).toBe(originalError);
      expect(error.originalError?.message).toBe('Network error');
    });

    it('should be instance of Error', () => {
      const error = new RedisError('test');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should create error with field errors', () => {
      const fields = {
        email: 'Invalid email format',
        password: 'Too short',
      };
      const error = new ValidationError(fields);

      expect(error.message).toContain('email: Invalid email format');
      expect(error.message).toContain('password: Too short');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
      expect(error.fields).toEqual(fields);
    });

    it('should be instance of DomainError', () => {
      const error = new ValidationError({ field: 'error' });
      expect(error).toBeInstanceOf(DomainError);
    });

    it('should handle single field error', () => {
      const error = new ValidationError({ count: 'Must be an integer' });

      expect(error.message).toBe('count: Must be an integer');
      expect(error.fields).toEqual({ count: 'Must be an integer' });
    });

    it('should handle multiple field errors', () => {
      const fields = {
        field1: 'Error 1',
        field2: 'Error 2',
        field3: 'Error 3',
      };
      const error = new ValidationError(fields);

      expect(error.fields).toEqual(fields);
      expect(error.message).toContain('field1');
      expect(error.message).toContain('field2');
      expect(error.message).toContain('field3');
    });

    it('should handle empty fields object', () => {
      const error = new ValidationError({});

      expect(error.message).toBe('');
      expect(error.fields).toEqual({});
    });
  });

  describe('Error hierarchy', () => {
    it('should maintain correct inheritance chain', () => {
      const domainError = new DomainError('test', 'CODE');
      const userError = new UserNotFoundError('user');
      const sessionError = new SessionExpiredError();
      const invalidSessionError = new InvalidSessionError();
      const rateLimitError = new RateLimitError(new Date());
      const clickError = new InvalidClickError('reason');
      const validationError = new ValidationError({ field: 'error' });

      expect(userError).toBeInstanceOf(DomainError);
      expect(sessionError).toBeInstanceOf(DomainError);
      expect(invalidSessionError).toBeInstanceOf(DomainError);
      expect(rateLimitError).toBeInstanceOf(DomainError);
      expect(clickError).toBeInstanceOf(DomainError);
      expect(validationError).toBeInstanceOf(DomainError);

      expect(domainError).toBeInstanceOf(Error);
      expect(userError).toBeInstanceOf(Error);
    });

    it('should allow error type checking', () => {
      const errors: Error[] = [
        new UserNotFoundError('test'),
        new TelegramApiError(400, 'Bad'),
        new DatabaseError('fail'),
        new RedisError('timeout'),
      ];

      const domainErrors = errors.filter(e => e instanceof DomainError);
      const telegramErrors = errors.filter(e => e instanceof TelegramApiError);

      expect(domainErrors).toHaveLength(1);
      expect(telegramErrors).toHaveLength(1);
    });
  });
});
