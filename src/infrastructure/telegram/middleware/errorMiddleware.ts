import type { BotMiddleware } from '../types';
import {
  RateLimitError,
  SessionExpiredError,
  InvalidSessionError,
  UserNotFoundError,
  TelegramApiError,
} from '../../../shared/errors';
import { ERROR_MESSAGES, EMOJIS } from '../../../shared/constants';

export const errorMiddleware: BotMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Bot error:', error);

    let message = `${EMOJIS.ERROR} An error occurred`;

    if (error instanceof RateLimitError) {
      const waitMs = error.retryAfter.getTime() - Date.now();
      const waitSeconds = Math.ceil(waitMs / 1000);
      message = `${EMOJIS.WARNING} <b>Rate Limit Exceeded!</b>

You've reached the maximum of <b>10 clicks per second</b>.

This limit exists to:
• Protect the bot from Telegram API limits
• Ensure fair play for all ${EMOJIS.TROPHY}
• Keep the bot running smoothly for 100k+ users

⏱ Wait <b>${waitSeconds} second${waitSeconds > 1 ? 's' : ''}</b> before clicking again.

<i>Tip: Click steadily, not too fast!</i>`;
    } else if (error instanceof SessionExpiredError) {
      message = `${EMOJIS.INFO} ${ERROR_MESSAGES.SESSION_EXPIRED}`;
      // Clear session
      ctx.session.user = undefined;
      ctx.session.session = undefined;
    } else if (error instanceof InvalidSessionError) {
      message = `${EMOJIS.WARNING} Invalid session. Please use /start to begin.`;
      ctx.session.user = undefined;
      ctx.session.session = undefined;
    } else if (error instanceof UserNotFoundError) {
      message = `${EMOJIS.INFO} ${ERROR_MESSAGES.NOT_FOUND}`;
    } else if (error instanceof TelegramApiError) {
      message = `${EMOJIS.ERROR} ${ERROR_MESSAGES.TELEGRAM_ERROR}`;
    } else if (error instanceof Error) {
      message = `${EMOJIS.ERROR} ${ERROR_MESSAGES.DATABASE_ERROR}`;
    }

    try {
      await ctx.reply(message, {
        parse_mode: 'HTML',
      });
    } catch (replyError) {
      console.error('Failed to send error message:', replyError);
    }
  }
};
