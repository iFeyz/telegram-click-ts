import type { BotContext } from '../../infrastructure/telegram/types';
import { User } from '../../domain/entities/User';
import { Session } from '../../domain/entities/Session';
import { createMockContext } from '../mocks/grammyMock';

interface ContextBuilderOptions {
  userId?: bigint;
  chatId?: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  customName?: string;
  score?: bigint;
  messageText?: string;
  callbackData?: string;
  withSession?: boolean;
  withUser?: boolean;
  gameState?: 'idle' | 'clicking' | 'cooldown';
}

export class ContextBuilder {
  private options: ContextBuilderOptions = {
    gameState: 'idle',
  };

  withUserId(userId: bigint): this {
    this.options.userId = userId;
    return this;
  }

  withChatId(chatId: bigint): this {
    this.options.chatId = chatId;
    return this;
  }

  withUsername(username: string): this {
    this.options.username = username;
    return this;
  }

  withName(firstName: string, lastName?: string): this {
    this.options.firstName = firstName;
    this.options.lastName = lastName;
    return this;
  }

  withCustomName(customName: string): this {
    this.options.customName = customName;
    return this;
  }

  withScore(score: bigint): this {
    this.options.score = score;
    return this;
  }

  withMessage(text: string): this {
    this.options.messageText = text;
    return this;
  }

  withCallback(data: string): this {
    this.options.callbackData = data;
    return this;
  }

  withSession(): this {
    this.options.withSession = true;
    this.options.withUser = true;
    return this;
  }

  withUser(): this {
    this.options.withUser = true;
    return this;
  }

  withGameState(state: 'idle' | 'clicking' | 'cooldown'): this {
    this.options.gameState = state;
    return this;
  }

  build(): BotContext {
    const ctx = createMockContext({
      userId: this.options.userId,
      chatId: this.options.chatId,
      username: this.options.username,
      firstName: this.options.firstName,
      lastName: this.options.lastName,
      messageText: this.options.messageText,
      callbackData: this.options.callbackData,
    });

    ctx.session.gameState = this.options.gameState ?? 'idle';
    ctx.session.clickBuffer = [];

    if (this.options.withUser) {
      const userId = this.options.userId ?? BigInt(123456);
      ctx.session.user = new User({
        id: `user-${userId}`,
        telegramId: userId,
        username: this.options.username,
        firstName: this.options.firstName ?? 'Test',
        lastName: this.options.lastName,
        customName: this.options.customName,
        score: this.options.score ?? BigInt(0),
      });
    }

    if (this.options.withSession && this.options.withUser) {
      ctx.session.session = new Session({
        userId: ctx.session.user!.id,
        telegramId: ctx.session.user!.telegramId,
        username: this.options.username,
      });
    }

    return ctx;
  }
}

export function buildContext(options?: ContextBuilderOptions): BotContext {
  const builder = new ContextBuilder();
  if (options) {
    if (options.userId) builder.withUserId(options.userId);
    if (options.chatId) builder.withChatId(options.chatId);
    if (options.username) builder.withUsername(options.username);
    if (options.firstName) builder.withName(options.firstName, options.lastName);
    if (options.customName) builder.withCustomName(options.customName);
    if (options.score !== undefined) builder.withScore(options.score);
    if (options.messageText) builder.withMessage(options.messageText);
    if (options.callbackData) builder.withCallback(options.callbackData);
    if (options.withSession) builder.withSession();
    if (options.withUser) builder.withUser();
    if (options.gameState) builder.withGameState(options.gameState);
  }
  return builder.build();
}
