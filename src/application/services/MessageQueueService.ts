import Bull from 'bull';
import type { Bot, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../infrastructure/telegram/types';
import { TELEGRAM_LIMITS } from '../../shared/constants';


interface ActionJob {
  type: 'message' | 'action' | 'edit';
  chatId: string;
  message?: string;
  options?: {
    parse_mode?: 'HTML' | 'Markdown';
    reply_markup?: InlineKeyboard;
  };
  action?: () => Promise<void>;
  description?: string;
  priority?: number;
}

/**
 * Message Queue Service
 */
export class MessageQueueService {
  private queue: Bull.Queue<ActionJob>;
  private bot: Bot<BotContext>;

  constructor(bot: Bot<BotContext>) {
    this.bot = bot;

    this.queue = new Bull('telegram-queue', {
      redis: {
        host: 'localhost',
        port: 6379,
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.setupProcessor();
    this.setupEventHandlers();
  }

  /**
   * Process both messages and actions respecting Telegram rate limits
   */
  private setupProcessor(): void {
    this.queue.process(25, async (job) => {
      const data = job.data as ActionJob;

      try {
        if (data.type === 'action' && data.action) {
          await data.action();
          console.log(`[QUEUE] Action executed: ${data.description || 'unknown'}`);
        } else if (data.type === 'message' && data.message) {
          await this.bot.api.sendMessage(data.chatId, data.message, data.options);
          console.log(`[QUEUE] Message sent to chat ${data.chatId}`);
        } else if (data.type === 'edit' && data.action) {
          await data.action();
          console.log(`[QUEUE] Edit executed for chat ${data.chatId}`);
        }

        await this.delay(TELEGRAM_LIMITS.BROADCAST_DELAY_MS);

        return { success: true, chatId: data.chatId };
      } catch (error) {
        console.error(`[QUEUE] Failed to process job for ${data.chatId}:`, error);
        throw error;
      }
    });
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.queue.on('completed', (job, result) => {
      console.log(`[QUEUE] Job ${job.id} completed:`, result);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`[QUEUE] Job ${job?.id} failed:`, err.message);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`[QUEUE] Job ${job.id} stalled and will be retried`);
    });

    setInterval(async () => {
      const counts = await this.queue.getJobCounts();
      if (counts.waiting > 1000 || counts.delayed > 500) {
        console.warn('[QUEUE WARNING] High queue load:', counts);
      }
    }, 10000);
  }

  /**
   * Add message to queue
   */
  async queueMessage(
    chatId: string,
    message: string,
    options?: ActionJob['options'],
    priority = 0,
  ): Promise<void> {
    await this.queue.add(
      {
        type: 'message',
        chatId,
        message,
        options,
        priority,
      },
      {
        priority,
        delay: 0,
      },
    );
  }

  /**
   * Queue an action
   */
  async queueAction(
    chatId: string,
    action: () => Promise<void>,
    description: string = '',
    priority = 0,
  ): Promise<void> {
    await this.queue.add(
      {
        type: 'action',
        chatId,
        action,
        description,
        priority,
      },
      {
        priority,
        delay: 0,
      },
    );
  }

  /**
   * Queue a message edit
   */
  async queueEdit(
    chatId: string,
    editAction: () => Promise<void>,
    description: string = '',
    priority = 0,
  ): Promise<void> {
    await this.queue.add(
      {
        type: 'edit',
        chatId,
        action: editAction,
        description,
        priority,
      },
      {
        priority,
        delay: 0,
      },
    );
  }

  /**
   * Broadcast message to multiple users
   */
  async broadcastMessage(
    chatIds: string[],
    message: string,
    options?: ActionJob['options'],
  ): Promise<void> {
    console.log(`[BROADCAST] Queuing message for ${chatIds.length} users`);

    const chunkSize = TELEGRAM_LIMITS.MAX_RECIPIENTS_PER_BROADCAST;
    const chunks = [];

    for (let i = 0; i < chatIds.length; i += chunkSize) {
      chunks.push(chatIds.slice(i, i + chunkSize));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      const delay = i * 1000;

      for (const chatId of chunk) {
        await this.queue.add(
          {
            type: 'message',
            chatId,
            message,
            options,
            priority: -1,
          },
          {
            delay,
            priority: -1,
          },
        );
      }

      console.log(`[BROADCAST] Queued chunk ${i + 1}/${chunks.length}`);
    }

    console.log(`[BROADCAST] All messages queued successfully`);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      ...counts,
      paused: 0,
    };
  }

  /**
   * Pause queue processing
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    console.log('[QUEUE] Processing paused');
  }

  /**
   * Resume queue processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    console.log('[QUEUE] Processing resumed');
  }

  /**
   * Clear all jobs from queue
   */
  async clear(): Promise<void> {
    await this.queue.empty();
    console.log('[QUEUE] All jobs cleared');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.queue.close();
    console.log('[QUEUE] Queue closed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
