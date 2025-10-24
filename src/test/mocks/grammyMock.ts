import type { Api, RawApi } from 'grammy';
import type { BotContext, BotSessionData } from '../../infrastructure/telegram/types';

interface MockContextParams {
  userId?: bigint;
  chatId?: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  messageText?: string;
  callbackData?: string;
}

export class GrammyContextMock {
  public from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };

  public chat?: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
  };

  public message?: {
    message_id: number;
    text?: string;
    date: number;
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
    };
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
    };
  };

  public callbackQuery?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
    };
    data?: string;
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: 'private' | 'group' | 'supergroup' | 'channel';
      };
    };
  };

  public session: BotSessionData = {
    gameState: 'idle',
    clickBuffer: [],
  };

  public api: Partial<Api<RawApi>> = {
    sendMessage: jest.fn(),
    editMessageText: jest.fn(),
    answerCallbackQuery: jest.fn(),
    deleteMessage: jest.fn(),
  };

  public replies: unknown[] = [];
  public edits: unknown[] = [];
  public answers: unknown[] = [];

  constructor(params: MockContextParams = {}) {
    const userId = Number(params.userId ?? BigInt(123456));
    const chatId = Number(params.chatId ?? params.userId ?? BigInt(123456));

    this.from = {
      id: userId,
      is_bot: false,
      first_name: params.firstName ?? 'Test',
      last_name: params.lastName,
      username: params.username,
      language_code: 'en',
    };

    this.chat = {
      id: chatId,
      type: 'private',
    };

    if (params.messageText) {
      this.message = {
        message_id: Math.floor(Math.random() * 10000),
        text: params.messageText,
        date: Math.floor(Date.now() / 1000),
        chat: this.chat,
        from: this.from,
      };
    }

    if (params.callbackData) {
      this.callbackQuery = {
        id: `callback_${Date.now()}`,
        from: this.from,
        data: params.callbackData,
        message: {
          message_id: Math.floor(Math.random() * 10000),
          chat: this.chat,
        },
      };
    }
  }

  async reply(text: string, extra?: unknown): Promise<{ message_id: number }> {
    const message = {
      message_id: Math.floor(Math.random() * 10000),
      text,
      ...((extra as object) || {}),
    };
    this.replies.push(message);
    return message;
  }

  async editMessageText(text: string, extra?: unknown): Promise<true> {
    this.edits.push({ text, ...((extra as object) || {}) });
    return true;
  }

  async answerCallbackQuery(text?: string, extra?: unknown): Promise<true> {
    this.answers.push({ text, ...((extra as object) || {}) });
    return true;
  }
}

export function createMockContext(params: MockContextParams = {}): BotContext {
  return new GrammyContextMock(params) as unknown as BotContext;
}

export function createMockMessageContext(text: string, userId?: bigint): BotContext {
  return createMockContext({ messageText: text, userId });
}

export function createMockCallbackContext(data: string, userId?: bigint): BotContext {
  return createMockContext({ callbackData: data, userId });
}
