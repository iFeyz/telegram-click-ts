export class DomainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class UserNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

export class SessionExpiredError extends DomainError {
  constructor() {
    super('Session has expired', 'SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

export class InvalidSessionError extends DomainError {
  constructor() {
    super('Invalid session token', 'INVALID_SESSION');
    this.name = 'InvalidSessionError';
  }
}

export class RateLimitError extends DomainError {
  public readonly retryAfter: Date;

  constructor(retryAfter: Date) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class InvalidClickError extends DomainError {
  constructor(reason: string) {
    super(`Invalid click: ${reason}`, 'INVALID_CLICK');
    this.name = 'InvalidClickError';
  }
}

export class TelegramApiError extends Error {
  public readonly errorCode: number;
  public readonly description: string;

  constructor(errorCode: number, description: string) {
    super(`Telegram API error ${errorCode}: ${description}`);
    this.name = 'TelegramApiError';
    this.errorCode = errorCode;
    this.description = description;
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(`Database error: ${message}`);
    this.name = 'DatabaseError';
  }
}

export class RedisError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(`Redis error: ${message}`);
    this.name = 'RedisError';
  }
}

export class ValidationError extends DomainError {
  public readonly fields: Record<string, string>;

  constructor(fields: Record<string, string>) {
    const message = Object.entries(fields)
      .map(([field, error]) => `${field}: ${error}`)
      .join(', ');
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}
