import type { BotMiddleware } from '../types';
import { ErrorHandlerRegistry } from '../../../application/errors/ErrorHandlerRegistry';
import { logger } from '../../observability/logger';
import { BotEvents } from '../../observability/events';

const errorRegistry = new ErrorHandlerRegistry();

export const errorMiddleware: BotMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    const errorResponse = await errorRegistry.handle(error, ctx);

    const errorMessage = error instanceof Error ? error.message : String(error);

    switch (errorResponse.logLevel) {
      case 'error':
        logger.error({ event: BotEvents.BOT_ERROR, error: errorMessage });
        break;
      case 'warn':
        logger.warn({ event: BotEvents.BOT_ERROR, error: errorMessage });
        break;
      case 'info':
        logger.info({ event: BotEvents.BOT_ERROR, error: errorMessage });
        break;
    }

    if (errorResponse.shouldClearSession) {
      ctx.session.user = undefined;
      ctx.session.session = undefined;
    }

    if (errorResponse.shouldReply) {
      try {
        await ctx.reply(errorResponse.message, {
          parse_mode: 'HTML',
        });
      } catch (replyError) {
        logger.error({
          message: 'Failed to send error message',
          error: replyError instanceof Error ? replyError.message : String(replyError),
        });
      }
    }
  }
};
