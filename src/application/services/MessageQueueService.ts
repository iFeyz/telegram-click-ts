import Bull from 'bull';
import type { Bot, InlineKeyboard } from 'grammy';
import type Redis from 'ioredis';
import type { BotContext } from '../../infrastructure/telegram/types';
import { TELEGRAM_LIMITS } from '../../shared/constants';
import { ActionChannel } from '../../domain/value-objects/ActionChannel';
import { redisClient } from '../../infrastructure/redis/client';
import { config } from '../../shared/config/env';
import type { IMessageQueue } from '../../domain/interfaces/IMessageQueue';
import { TelegramApiError } from '../../shared/errors';

interface TelegramRateLimitError {
  error_code: number;
  description: string;
  parameters?: {
    retry_after?: number;
  };
}

function isTelegramRateLimitError(error: unknown): error is TelegramRateLimitError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error_code' in error &&
    (error as TelegramRateLimitError).error_code === 429
  );
}

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
  channel?: {
    domain: string;
    context: string;
    isReplaceable: boolean;
  };
}

export class MessageQueueService implements IMessageQueue {
  private queue: Bull.Queue<ActionJob>;
  private bot: Bot<BotContext>;
  private redis: Redis;
  private readonly channelTtl: number;

  constructor(bot: Bot<BotContext>) {
    this.bot = bot;
    this.redis = redisClient.getClient();
    this.channelTtl = config.queue.channelTrackingTtlSeconds;

    this.queue = new Bull('telegram-queue', {
      redis: {
        host: 'localhost',
        port: 6379,
      },
      limiter: {
        max: 28,
        duration: 1000,
        bounceBack: true,
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

  private setupProcessor(): void {
    this.queue.process(10, async (job) => {
      const data = job.data as ActionJob;

      try {
        if (data.channel) {
          const channel = ActionChannel.deserialize(data.channel);
          const isLatest = await this.isLatestInChannel(data.chatId, channel, job.id!.toString());

          if (!isLatest) {
            console.log(
              `[QUEUE] Skipped superseded job ${job.id} for ${data.chatId} in channel ${channel.fullName}`,
            );
            return { skipped: true, reason: 'superseded', chatId: data.chatId };
          }
        }

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

        return { success: true, chatId: data.chatId };
      } catch (error) {
        if (isTelegramRateLimitError(error)) {
          const retryAfter = error.parameters?.retry_after || 1;
          console.error(`[QUEUE] Rate limited! Retry after ${retryAfter}s`);
          throw new TelegramApiError(error.error_code, error.description);
        }
        console.error(`[QUEUE] Failed to process job for ${data.chatId}:`, error);
        throw error;
      }
    });
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', async (job, result) => {
      console.log(`[QUEUE] Job ${job.id} completed:`, result);
      await this.cleanupChannelTracking(job.data);
    });

    this.queue.on('failed', async (job, err) => {
      console.error(`[QUEUE] Job ${job?.id} failed:`, err.message);
      if (job) {
        await this.cleanupChannelTracking(job.data);
      }
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

  async queueMessage(
    chatId: string,
    message: string,
    options?: ActionJob['options'],
    priority = 0,
    channel?: ActionChannel,
  ): Promise<void> {
    if (channel?.isReplaceable) {
      await this.removePreviousChannelJob(chatId, channel);
    }

    const job = await this.queue.add(
      {
        type: 'message',
        chatId,
        message,
        options,
        priority,
        channel: channel
          ? {
              domain: channel.domain,
              context: channel.context,
              isReplaceable: channel.isReplaceable,
            }
          : undefined,
      },
      {
        priority,
        delay: 0,
      },
    );

    if (channel?.isReplaceable) {
      await this.trackChannelJob(chatId, channel, job.id!.toString());
    }
  }

  async queueAction(
    chatId: string,
    action: () => Promise<void>,
    description: string = '',
    priority = 0,
    channel?: ActionChannel,
  ): Promise<void> {
    if (channel?.isReplaceable) {
      await this.removePreviousChannelJob(chatId, channel);
    }

    const job = await this.queue.add(
      {
        type: 'action',
        chatId,
        action,
        description,
        priority,
        channel: channel
          ? {
              domain: channel.domain,
              context: channel.context,
              isReplaceable: channel.isReplaceable,
            }
          : undefined,
      },
      {
        priority,
        delay: 0,
      },
    );

    if (channel?.isReplaceable) {
      await this.trackChannelJob(chatId, channel, job.id!.toString());
    }
  }

  async queueEdit(
    chatId: string,
    editAction: () => Promise<void>,
    description: string = '',
    priority = 0,
    channel?: ActionChannel,
  ): Promise<void> {
    if (channel?.isReplaceable) {
      await this.removePreviousChannelJob(chatId, channel);
    }

    const job = await this.queue.add(
      {
        type: 'edit',
        chatId,
        action: editAction,
        description,
        priority,
        channel: channel
          ? {
              domain: channel.domain,
              context: channel.context,
              isReplaceable: channel.isReplaceable,
            }
          : undefined,
      },
      {
        priority,
        delay: 0,
      },
    );

    if (channel?.isReplaceable) {
      await this.trackChannelJob(chatId, channel, job.id!.toString());
    }
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

  private async trackChannelJob(
    chatId: string,
    channel: ActionChannel,
    jobId: string,
  ): Promise<void> {
    const key = channel.getTrackingKey(chatId);
    await this.redis.setex(key, this.channelTtl, jobId);
  }

  private async removePreviousChannelJob(chatId: string, channel: ActionChannel): Promise<void> {
    const key = channel.getTrackingKey(chatId);
    const previousJobId = await this.redis.get(key);

    if (!previousJobId) return;

    try {
      const previousJob = await this.queue.getJob(previousJobId);

      if (!previousJob) {
        await this.redis.del(key);
        return;
      }

      const state = await previousJob.getState();

      if (state === 'waiting' || state === 'delayed') {
        await previousJob.remove();
        console.log(
          `[QUEUE] Removed superseded job ${previousJobId} for ${chatId} in channel ${channel.fullName}`,
        );
      }
    } catch (error) {
      console.log(`[QUEUE] Could not remove job ${previousJobId}:`, (error as Error).message);
    }
  }

  private async isLatestInChannel(
    chatId: string,
    channel: ActionChannel,
    jobId: string,
  ): Promise<boolean> {
    const key = channel.getTrackingKey(chatId);
    const latestJobId = await this.redis.get(key);
    return latestJobId === jobId;
  }

  private async cleanupChannelTracking(jobData: ActionJob): Promise<void> {
    if (!jobData.channel) return;

    const channel = ActionChannel.deserialize(jobData.channel);
    const key = channel.getTrackingKey(jobData.chatId);
    const currentJobId = await this.redis.get(key);

    if (currentJobId === jobData.chatId) {
      await this.redis.del(key);
    }
  }
}
