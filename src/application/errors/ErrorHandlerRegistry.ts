import type { IErrorHandler, ErrorResponse } from '../../domain/interfaces/IErrorHandler';
import type { BotContext } from '../../infrastructure/telegram/types';
import { RateLimitErrorHandler } from './RateLimitErrorHandler';
import { SessionExpiredErrorHandler, InvalidSessionErrorHandler } from './SessionErrorHandler';
import { TelegramApiErrorHandler } from './TelegramApiErrorHandler';
import {
  UserNotFoundErrorHandler,
  DatabaseErrorHandler,
  RedisErrorHandler,
  ValidationErrorHandler,
} from './DomainErrorHandlers';
import { FallbackErrorHandler } from './FallbackErrorHandler';

export class ErrorHandlerRegistry {
  private handlers: IErrorHandler[] = [];

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    this.register(new RateLimitErrorHandler());
    this.register(new SessionExpiredErrorHandler());
    this.register(new InvalidSessionErrorHandler());
    this.register(new TelegramApiErrorHandler());
    this.register(new UserNotFoundErrorHandler());
    this.register(new DatabaseErrorHandler());
    this.register(new RedisErrorHandler());
    this.register(new ValidationErrorHandler());
    this.register(new FallbackErrorHandler());
  }

  register(handler: IErrorHandler): void {
    this.handlers.push(handler);
  }

  async handle(error: unknown, ctx: BotContext): Promise<ErrorResponse> {
    for (const handler of this.handlers) {
      if (handler.canHandle(error)) {
        return await handler.handle(error, ctx);
      }
    }

    return await new FallbackErrorHandler().handle(error, ctx);
  }
}
