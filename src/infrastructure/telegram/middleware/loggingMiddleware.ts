import type { BotMiddleware } from '../types';

export const loggingMiddleware: BotMiddleware = async (ctx, next) => {
  const start = Date.now();
  const from = ctx.from;
  const chat = ctx.chat;

  console.log(
    `[${new Date().toISOString()}] Update from ${from?.username || from?.id} in ${chat?.type}`,
  );

  await next();

  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] Processed in ${duration}ms`);
};
