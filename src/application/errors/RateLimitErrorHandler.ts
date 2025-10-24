import { BaseErrorHandler } from './BaseErrorHandler';
import { RateLimitError } from '../../shared/errors';
import type { ErrorResponse } from '../../domain/interfaces/IErrorHandler';
import type { BotContext } from '../../infrastructure/telegram/types';
import { EMOJIS } from '../../shared/constants';

export class RateLimitErrorHandler extends BaseErrorHandler<RateLimitError> {
  constructor() {
    super(RateLimitError);
  }

  async handle(error: RateLimitError, _ctx: BotContext): Promise<ErrorResponse> {
    const waitMs = error.retryAfter.getTime() - Date.now();
    const waitSeconds = Math.ceil(waitMs / 1000);

    return {
      message: `${EMOJIS.WARNING} <b>Rate Limit Exceeded!</b>

You've reached the maximum of <b>10 clicks per second</b>.

This limit exists to:
• Protect the bot from Telegram API limits
• Ensure fair play for all ${EMOJIS.TROPHY}
• Keep the bot running smoothly for 100k+ users

⏱ Wait <b>${waitSeconds} second${waitSeconds > 1 ? 's' : ''}</b> before trying again.

<i>Tip: Click steadily, not too fast!</i>`,
      shouldReply: true,
      logLevel: 'warn',
    };
  }
}
