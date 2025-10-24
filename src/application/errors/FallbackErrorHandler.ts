import type { IErrorHandler, ErrorResponse } from '../../domain/interfaces/IErrorHandler';
import type { BotContext } from '../../infrastructure/telegram/types';
import { EMOJIS } from '../../shared/constants';

export class FallbackErrorHandler implements IErrorHandler {
  canHandle(_error: unknown): boolean {
    return true;
  }

  async handle(_error: unknown, _ctx: BotContext): Promise<ErrorResponse> {
    return {
      message: `${EMOJIS.ERROR} <b>Unexpected Error</b>

Something went wrong. Our team has been notified.

<i>Please try again later.</i>`,
      shouldReply: true,
      logLevel: 'error',
    };
  }
}
