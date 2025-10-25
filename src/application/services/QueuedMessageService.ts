import type { InlineKeyboard } from 'grammy';
import type { MessageQueueService } from './MessageQueueService';
import type { ActionChannel } from '../../domain/value-objects/ActionChannel';
import { logger } from '../../infrastructure/observability/logger';

export class QueuedMessageService {
  private messageQueue: MessageQueueService;

  constructor(messageQueue: MessageQueueService) {
    this.messageQueue = messageQueue;
  }

  async sendMessage(
    chatId: string,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
    channel?: ActionChannel,
  ): Promise<void> {
    try {
      await this.messageQueue.queueMessage(chatId, message, options, 0, channel);
    } catch (error) {
      logger.error({
        message: 'Failed to queue message',
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sendPriorityMessage(
    chatId: string,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard | { force_reply: boolean; input_field_placeholder?: string };
    },
    channel?: ActionChannel,
  ): Promise<void> {
    try {
      await this.messageQueue.queueMessage(
        chatId,
        message,
        {
          ...options,
          reply_markup: options?.reply_markup as InlineKeyboard,
        },
        10,
        channel,
      );
    } catch (error) {
      logger.error({
        message: 'Failed to queue priority message',
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sendNotification(
    chatId: string,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
    channel?: ActionChannel,
  ): Promise<void> {
    try {
      await this.messageQueue.queueMessage(chatId, message, options, -1, channel);
    } catch (error) {
      logger.error({
        message: 'Failed to queue notification',
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async broadcastMessage(
    chatIds: string[],
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
  ): Promise<void> {
    logger.info({ message: 'Broadcasting message', userCount: chatIds.length });
    await this.messageQueue.broadcastMessage(chatIds, message, options);
  }

  async sendLeaderboardUpdate(
    chatId: string,
    leaderboard: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
    channel?: ActionChannel,
  ): Promise<void> {
    try {
      await this.messageQueue.queueMessage(chatId, leaderboard, options, -2, channel);
    } catch (error) {
      logger.error({
        message: 'Failed to queue leaderboard update',
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sendError(
    chatId: string,
    errorMessage: string,
    options?: {
      reply_markup?: InlineKeyboard;
    },
    channel?: ActionChannel,
  ): Promise<void> {
    const message = `❌ <b>Error</b>\n\n${errorMessage}`;
    try {
      await this.messageQueue.queueMessage(
        chatId,
        message,
        { ...options, parse_mode: 'HTML' },
        5,
        channel,
      );
    } catch (error) {
      logger.error({
        message: 'Failed to send error message',
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async queueNavigationAction(
    chatId: string,
    action: () => Promise<void>,
    description: string = '',
    priority: number = 0,
    channel?: ActionChannel,
  ): Promise<void> {
    try {
      await this.messageQueue.queueAction(chatId, action, description, priority, channel);
    } catch (error) {
      logger.error({
        message: 'Failed to queue action',
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async queueMessageEdit(
    chatId: string,
    editAction: () => Promise<void>,
    description: string = '',
    priority: number = 0,
    channel?: ActionChannel,
  ): Promise<void> {
    try {
      await this.messageQueue.queueEdit(chatId, editAction, description, priority, channel);
    } catch (error) {
      logger.error({
        message: 'Failed to queue edit',
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const stats = await this.messageQueue.getQueueStats();
    return {
      waiting: stats.waiting,
      active: stats.active,
      completed: stats.completed,
      failed: stats.failed,
    };
  }

  /**
   * Check if we're under heavy load
   */
  async isUnderHeavyLoad(): Promise<boolean> {
    const stats = await this.getQueueStats();
    return stats.waiting > 100;
  }

  async pauseNonCritical(): Promise<void> {
    await this.messageQueue.pause();
    logger.warn({ message: 'Paused non-critical messages due to high load' });
  }

  /**
   * Resume message processing
   */
  async resume(): Promise<void> {
    await this.messageQueue.resume();
    logger.info({ message: 'Resumed message processing' });
  }
}
