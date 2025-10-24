import type { BotContext } from '../../infrastructure/telegram/types';

export interface ErrorResponse {
  message: string;
  shouldReply: boolean;
  shouldClearSession?: boolean;
  logLevel: 'error' | 'warn' | 'info';
}

export interface IErrorHandler {
  canHandle(error: unknown): boolean;
  handle(error: unknown, ctx: BotContext): Promise<ErrorResponse>;
}
