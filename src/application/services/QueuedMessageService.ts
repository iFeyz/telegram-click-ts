import type { InlineKeyboard } from 'grammy';
import type { MessageQueueService } from './MessageQueueService';

export class QueuedMessageService {
  private messageQueue: MessageQueueService;

  constructor(messageQueue: MessageQueueService) {
    this.messageQueue = messageQueue;
  }

  /**
   * Send a general message through the queue (rate-limited to 25 msg/sec)
   */
  async sendMessage(
    chatId: string,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
  ): Promise<void> {
    try {
      await this.messageQueue.queueMessage(chatId, message, options);
    } catch (error) {
      console.error(`[QueuedMessage] Failed to queue message for ${chatId}:`, error);
    }
  }

  /**
   * Send message with higher priority (for important system messages)
   */
  async sendPriorityMessage(
    chatId: string,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard | { force_reply: boolean; input_field_placeholder?: string };
    },
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
      );
    } catch (error) {
      console.error(`[QueuedMessage] Failed to queue priority message for ${chatId}:`, error);
    }
  }

  /**
   * Send notification messages (lower priority)
   */
  async sendNotification(
    chatId: string,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
  ): Promise<void> {
    try {
      await this.messageQueue.queueMessage(chatId, message, options, -1);
    } catch (error) {}
  }

  async broadcastMessage(
    chatIds: string[],
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
  ): Promise<void> {
    console.warn(`[QueuedMessage] Broadcasting to ${chatIds.length} users`);
    await this.messageQueue.broadcastMessage(chatIds, message, options);
  }

  /**
   * Send leaderboard updates (batched and queued)
   */
  async sendLeaderboardUpdate(
    chatId: string,
    leaderboard: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      reply_markup?: InlineKeyboard;
    },
  ): Promise<void> {
    try {
      await this.messageQueue.queueMessage(chatId, leaderboard, options, -2);
    } catch (error) {}
  }

  async sendError(
    chatId: string,
    errorMessage: string,
    options?: {
      reply_markup?: InlineKeyboard;
    },
  ): Promise<void> {
    const message = `❌ <b>Error</b>\n\n${errorMessage}`;
    try {
      await this.messageQueue.queueMessage(chatId, message, { ...options, parse_mode: 'HTML' }, 5);
    } catch (error) {
      console.error(`[QueuedMessage] Failed to send error message to ${chatId}:`, error);
    }
  }

  /**
   * Queue a navigation action (button clicks, menu navigation, etc.)
   */
  async queueNavigationAction(
    chatId: string,
    action: () => Promise<void>,
    description: string = '',
    priority: number = 0,
  ): Promise<void> {
    try {
      await this.messageQueue.queueAction(chatId, action, description, priority);
    } catch (error) {
      console.error(`[QueuedMessage] Failed to queue action for ${chatId}:`, error);
    }
  }

  /**
   * Queue a message edit (for inline keyboard updates)
   */
  async queueMessageEdit(
    chatId: string,
    editAction: () => Promise<void>,
    description: string = '',
    priority: number = 0,
  ): Promise<void> {
    try {
      await this.messageQueue.queueEdit(chatId, editAction, description, priority);
    } catch (error) {
      console.error(`[QueuedMessage] Failed to queue edit for ${chatId}:`, error);
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
    console.warn('[QueuedMessage] Paused non-critical messages due to high load');
  }

  /**
   * Resume message processing
   */
  async resume(): Promise<void> {
    await this.messageQueue.resume();
    console.warn('[QueuedMessage] Resumed message processing');
  }
}
