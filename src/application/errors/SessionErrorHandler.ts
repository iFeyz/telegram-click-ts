import { BaseErrorHandler } from './BaseErrorHandler';
import { SessionExpiredError, InvalidSessionError } from '../../shared/errors';
import type { ErrorResponse } from '../../domain/interfaces/IErrorHandler';
import type { BotContext } from '../../infrastructure/telegram/types';
import { EMOJIS, ERROR_MESSAGES } from '../../shared/constants';

export class SessionExpiredErrorHandler extends BaseErrorHandler<SessionExpiredError> {
  constructor() {
    super(SessionExpiredError);
  }

  async handle(_error: SessionExpiredError, _ctx: BotContext): Promise<ErrorResponse> {
    return {
      message: `${EMOJIS.INFO} ${ERROR_MESSAGES.SESSION_EXPIRED}`,
      shouldReply: true,
      shouldClearSession: true,
      logLevel: 'info',
    };
  }
}

export class InvalidSessionErrorHandler extends BaseErrorHandler<InvalidSessionError> {
  constructor() {
    super(InvalidSessionError);
  }

  async handle(_error: InvalidSessionError, _ctx: BotContext): Promise<ErrorResponse> {
    return {
      message: `${EMOJIS.WARNING} Invalid session. Please use /start to begin.`,
      shouldReply: true,
      shouldClearSession: true,
      logLevel: 'warn',
    };
  }
}
