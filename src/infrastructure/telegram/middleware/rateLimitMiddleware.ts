import type { BotMiddleware } from '../types';
import { container } from '../../../shared/container/DIContainer';
import { RateLimitError } from '../../../shared/errors';
import { logger } from '../../observability/logger';
import { BotEvents } from '../../observability/events';

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
      logger.warn({
        event: BotEvents.RATE_LIMIT_HIT,
        limitType: 'global',
        remaining: globalResult.remaining,
        max: 30,
      });
      throw new RateLimitError(globalResult.resetAt);
    }

    const chatResult = await rateLimiter.checkTelegramRateLimit(chatId, 20);

    if (!chatResult.allowed) {
      logger.warn({
        event: BotEvents.RATE_LIMIT_HIT,
        limitType: 'chat',
        chatId,
        username,
        userId,
      });
      throw new RateLimitError(chatResult.resetAt);
    }

    if (globalResult.remaining < 10) {
      logger.warn({
        event: BotEvents.RATE_LIMIT_APPROACHING,
        limitType: 'global',
        remaining: globalResult.remaining,
        max: 30,
      });
    }
  }

  await next();
};
