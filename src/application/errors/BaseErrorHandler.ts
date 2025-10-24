import type { IErrorHandler, ErrorResponse } from '../../domain/interfaces/IErrorHandler';
import type { BotContext } from '../../infrastructure/telegram/types';

export abstract class BaseErrorHandler<T extends Error> implements IErrorHandler {
  constructor(private readonly errorType: new (...args: any[]) => T) {}

  canHandle(error: unknown): boolean {
    return error instanceof this.errorType;
  }

  abstract handle(error: T, ctx: BotContext): Promise<ErrorResponse>;
}
