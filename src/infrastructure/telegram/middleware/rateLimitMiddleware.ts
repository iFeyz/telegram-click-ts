import type { BotMiddleware } from '../types';
import { container } from '../../../shared/container/DIContainer';
import { RateLimitError } from '../../../shared/errors';

export const rateLimitMiddleware: BotMiddleware = async (ctx, next) => {
  if (!ctx.message && !ctx.callbackQuery) {
    await next();
    return;
  }

  const userId = ctx.from?.id.toString();
  const username = ctx.from?.username || 'unknown';

  if (!userId) {
    await next();
    return;
  }

  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const rateLimiter = container.getRateLimiterRepository();

    const globalResult = await rateLimiter.checkRateLimit('global:telegram', 30, 1);

    if (!globalResult.allowed) {
      console.warn(
        `[GLOBAL RATE LIMIT] Bot reached Telegram's global limit. Remaining: ${globalResult.remaining}/30 msg/sec`,
      );
      throw new RateLimitError(globalResult.resetAt);
    }

    const chatResult = await rateLimiter.checkTelegramRateLimit(chatId, 20);

    if (!chatResult.allowed) {
      console.warn(
        `[CHAT RATE LIMIT] Chat ${chatId} exceeded limit. User: ${username} (${userId})`,
      );
      throw new RateLimitError(chatResult.resetAt);
    }

    if (globalResult.remaining < 10) {
      console.warn(
        `[RATE LIMIT WARNING] Global limit low: ${globalResult.remaining}/30 messages remaining`,
      );
    }
  }

  await next();
};
