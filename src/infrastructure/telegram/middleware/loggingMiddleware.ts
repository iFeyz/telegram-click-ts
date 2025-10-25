import type { BotMiddleware } from '../types';
import { logger } from '../../../infrastructure/observability/logger';
import { metrics } from '../../../infrastructure/observability/metrics';
import { observabilityConfig } from '../../../shared/config/observability';
import {
  BotEvents,
  parseCommandName,
  isClickAction,
  isLeaderboardAction,
} from '../../../infrastructure/observability/events';

export const loggingMiddleware: BotMiddleware = async (ctx, next) => {
  const start = Date.now();
  const from = ctx.from;
  const chat = ctx.chat;
  const callbackData = ctx.callbackQuery?.data;
  const messageText = ctx.message?.text;

  const command = parseCommandName(messageText, callbackData);

  logger.info({
    event: BotEvents.REQUEST_RECEIVED,
    userId: from?.id,
    username: from?.username,
    chatType: chat?.type,
    command,
    callbackData,
  });

  let success = true;
  try {
    await next();
  } catch (error) {
    success = false;
    throw error;
  } finally {
    const duration = (Date.now() - start) / 1000;

    if (observabilityConfig.enabled) {
      logger.info({
        event: BotEvents.REQUEST_COMPLETED,
        userId: from?.id,
        command,
        duration,
        success,
      });

      metrics.requestsTotal.inc({ command, status: success ? 'success' : 'error' });
      metrics.requestDuration.observe({ command, success: String(success) }, duration);

      if (isClickAction(command, callbackData)) {
        metrics.clicksTotal.inc({ userId: String(from?.id || 'unknown') });
        logger.debug({
          event: BotEvents.CLICK_PERFORMED,
          userId: from?.id,
          command,
        });
      }

      if (isLeaderboardAction(command, callbackData)) {
        metrics.leaderboardViews.inc();
        logger.debug({
          event: BotEvents.LEADERBOARD_VIEWED,
          userId: from?.id,
          command,
        });
      }
    }
  }
};
