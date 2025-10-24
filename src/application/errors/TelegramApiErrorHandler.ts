import { BaseErrorHandler } from './BaseErrorHandler';
import { TelegramApiError } from '../../shared/errors';
import type { ErrorResponse } from '../../domain/interfaces/IErrorHandler';
import type { BotContext } from '../../infrastructure/telegram/types';
import { EMOJIS, ERROR_MESSAGES } from '../../shared/constants';

export class TelegramApiErrorHandler extends BaseErrorHandler<TelegramApiError> {
  constructor() {
    super(TelegramApiError);
  }

  async handle(error: TelegramApiError, _ctx: BotContext): Promise<ErrorResponse> {
    const isRateLimit = error.errorCode === 429;

    if (isRateLimit) {
      return {
        message: `${EMOJIS.WARNING} <b>Telegram Rate Limit</b>

The bot is experiencing high traffic. Please try again in a moment.

<i>This protects the bot from being blocked by Telegram.</i>`,
        shouldReply: true,
        logLevel: 'warn',
      };
    }

    return {
      message: `${EMOJIS.ERROR} ${ERROR_MESSAGES.TELEGRAM_ERROR}

<i>Error ${error.errorCode}: ${error.description}</i>`,
      shouldReply: true,
      logLevel: 'error',
    };
  }
}
