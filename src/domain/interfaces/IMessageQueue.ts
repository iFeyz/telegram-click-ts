import type { InlineKeyboard } from 'grammy';
import type { ActionChannel } from '../value-objects/ActionChannel';

export interface MessageOptions {
  parse_mode?: 'HTML' | 'Markdown';
  reply_markup?: InlineKeyboard;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface IMessageQueue {
  queueMessage(
    chatId: string,
    message: string,
    options?: MessageOptions,
    priority?: number,
    channel?: ActionChannel,
  ): Promise<void>;

  queueAction(
    chatId: string,
    action: () => Promise<void>,
    description?: string,
    priority?: number,
    channel?: ActionChannel,
  ): Promise<void>;

  queueEdit(
    chatId: string,
    editAction: () => Promise<void>,
    description?: string,
    priority?: number,
    channel?: ActionChannel,
  ): Promise<void>;

  broadcastMessage(chatIds: string[], message: string, options?: MessageOptions): Promise<void>;

  getQueueStats(): Promise<QueueStats>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  clear(): Promise<void>;
  shutdown(): Promise<void>;
}
