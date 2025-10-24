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

export function createUserNotFoundError(identifier = 'test-user'): UserNotFoundError {
  return new UserNotFoundError(identifier);
}

export function createSessionExpiredError(): SessionExpiredError {
  return new SessionExpiredError();
}

export function createInvalidSessionError(): InvalidSessionError {
  return new InvalidSessionError();
}

export function createRateLimitError(retryAfterSeconds = 1): RateLimitError {
  const retryAfter = new Date(Date.now() + retryAfterSeconds * 1000);
  return new RateLimitError(retryAfter);
}

export function createInvalidClickError(reason = 'Invalid click data'): InvalidClickError {
  return new InvalidClickError(reason);
}

export function createTelegramApiError(
  errorCode = 429,
  description = 'Too Many Requests',
): TelegramApiError {
  return new TelegramApiError(errorCode, description);
}

export function createDatabaseError(message = 'Database operation failed'): DatabaseError {
  return new DatabaseError(message);
}

export function createRedisError(message = 'Redis operation failed'): RedisError {
  return new RedisError(message);
}

export function createValidationError(fields: Record<string, string> = {}): ValidationError {
  return new ValidationError(fields);
}

export function assertErrorType<T extends Error>(
  error: unknown,
  ErrorClass: new (...args: unknown[]) => T,
): asserts error is T {
  expect(error).toBeInstanceOf(ErrorClass);
}

export function assertDomainError(
  error: unknown,
  expectedCode: string,
  expectedMessage?: string,
): void {
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(expectedCode);
  if (expectedMessage) {
    expect((error as DomainError).message).toContain(expectedMessage);
  }
}

export async function assertThrowsAsync<T extends Error>(
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: unknown[]) => T,
): Promise<T> {
  try {
    await fn();
    throw new Error(`Expected function to throw ${ErrorClass.name}`);
  } catch (error) {
    assertErrorType(error, ErrorClass);
    return error;
  }
}

export function assertThrows<T extends Error>(
  fn: () => unknown,
  ErrorClass: new (...args: unknown[]) => T,
): T {
  try {
    fn();
    throw new Error(`Expected function to throw ${ErrorClass.name}`);
  } catch (error) {
    assertErrorType(error, ErrorClass);
    return error;
  }
}
