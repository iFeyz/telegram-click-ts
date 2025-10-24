import type { BotMiddleware } from '../types';
import { ErrorHandlerRegistry } from '../../../application/errors/ErrorHandlerRegistry';

const errorRegistry = new ErrorHandlerRegistry();

export const errorMiddleware: BotMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    const errorResponse = await errorRegistry.handle(error, ctx);

    switch (errorResponse.logLevel) {
      case 'error':
        console.error('[ERROR]', error);
        break;
      case 'warn':
        console.warn('[WARN]', error instanceof Error ? error.message : error);
        break;
      case 'info':
        console.info('[INFO]', error instanceof Error ? error.message : error);
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
        console.error('[ERROR] Failed to send error message:', replyError);
      }
    }
  }
};
