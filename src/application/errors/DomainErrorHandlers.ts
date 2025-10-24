import { BaseErrorHandler } from './BaseErrorHandler';
import { UserNotFoundError, DatabaseError, RedisError, ValidationError } from '../../shared/errors';
import type { ErrorResponse } from '../../domain/interfaces/IErrorHandler';
import type { BotContext } from '../../infrastructure/telegram/types';
import { EMOJIS, ERROR_MESSAGES } from '../../shared/constants';

export class UserNotFoundErrorHandler extends BaseErrorHandler<UserNotFoundError> {
  constructor() {
    super(UserNotFoundError);
  }

  async handle(_error: UserNotFoundError, _ctx: BotContext): Promise<ErrorResponse> {
    return {
      message: `${EMOJIS.INFO} ${ERROR_MESSAGES.NOT_FOUND}`,
      shouldReply: true,
      logLevel: 'info',
    };
  }
}

export class DatabaseErrorHandler extends BaseErrorHandler<DatabaseError> {
  constructor() {
    super(DatabaseError);
  }

  async handle(_error: DatabaseError, _ctx: BotContext): Promise<ErrorResponse> {
    return {
      message: `${EMOJIS.ERROR} ${ERROR_MESSAGES.DATABASE_ERROR}

<i>Our team has been notified. Please try again later.</i>`,
      shouldReply: true,
      logLevel: 'error',
    };
  }
}

export class RedisErrorHandler extends BaseErrorHandler<RedisError> {
  constructor() {
    super(RedisError);
  }

  async handle(_error: RedisError, _ctx: BotContext): Promise<ErrorResponse> {
    return {
      message: `${EMOJIS.ERROR} Temporary service issue.

<i>Please try again in a moment.</i>`,
      shouldReply: true,
      logLevel: 'error',
    };
  }
}

export class ValidationErrorHandler extends BaseErrorHandler<ValidationError> {
  constructor() {
    super(ValidationError);
  }

  async handle(error: ValidationError, _ctx: BotContext): Promise<ErrorResponse> {
    const fieldErrors = Object.entries(error.fields)
      .map(([field, message]) => `• ${field}: ${message}`)
      .join('\n');

    return {
      message: `${EMOJIS.WARNING} <b>Validation Error</b>

${fieldErrors}

<i>Please check your input and try again.</i>`,
      shouldReply: true,
      logLevel: 'warn',
    };
  }
}
