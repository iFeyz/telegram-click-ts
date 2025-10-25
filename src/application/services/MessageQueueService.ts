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
import { logger } from '../../infrastructure/observability/logger';

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

          if (channel.isReplaceable) {
            const isLatest = await this.isLatestInChannel(data.chatId, channel, job.id!.toString());

            if (!isLatest) {
              logger.debug({
                message: 'Skipped superseded job',
                jobId: job.id,
                chatId: data.chatId,
                channel: channel.fullName,
              });
              return { skipped: true, reason: 'superseded', chatId: data.chatId };
            }
          }
        }

        if (data.type === 'action' && data.action) {
          await data.action();
          logger.debug({ message: 'Action executed', description: data.description || 'unknown' });
        } else if (data.type === 'message' && data.message !== undefined) {
          await this.bot.api.sendMessage(data.chatId, data.message, data.options);
          logger.debug({ message: 'Message sent', chatId: data.chatId });
        } else if (data.type === 'edit' && data.action) {
          await data.action();
          logger.debug({ message: 'Edit executed', chatId: data.chatId });
        }

        return { success: true, chatId: data.chatId };
      } catch (error) {
        if (isTelegramRateLimitError(error)) {
          const retryAfter = error.parameters?.retry_after || 1;
          logger.error({ message: 'Rate limited', retryAfterSeconds: retryAfter });
          throw new TelegramApiError(error.error_code, error.description);
        }
        logger.error({
          message: 'Failed to process job',
          chatId: data.chatId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    });
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', async (job, result) => {
      logger.debug({ message: 'Job completed', jobId: job.id, result });
      await this.cleanupChannelTracking(job.data);
    });

    this.queue.on('failed', async (job, err) => {
      logger.error({ message: 'Job failed', jobId: job?.id, error: err.message });
      if (job) {
        await this.cleanupChannelTracking(job.data);
      }
    });

    this.queue.on('stalled', (job) => {
      logger.warn({ message: 'Job stalled and will be retried', jobId: job.id });
    });

    setInterval(async () => {
      const counts = await this.queue.getJobCounts();
      if (counts.waiting > 1000 || counts.delayed > 500) {
        logger.warn({ message: 'High queue load', counts });
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
    logger.info({ message: 'Queuing broadcast message', userCount: chatIds.length });

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

      logger.debug({ message: 'Queued broadcast chunk', chunk: i + 1, total: chunks.length });
    }

    logger.info({ message: 'All broadcast messages queued successfully' });
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
    logger.info({ message: 'Queue processing paused' });
  }

  /**
   * Resume queue processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info({ message: 'Queue processing resumed' });
  }

  /**
   * Clear all jobs from queue
   */
  async clear(): Promise<void> {
    await this.queue.empty();
    logger.info({ message: 'All jobs cleared from queue' });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.queue.close();
    logger.info({ message: 'Queue closed' });
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
        logger.debug({
          message: 'Removed superseded job',
          previousJobId,
          chatId,
          channel: channel.fullName,
        });
      }
    } catch (error) {
      logger.debug({
        message: 'Could not remove previous job',
        previousJobId,
        error: (error as Error).message,
      });
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
    await this.redis.del(key);
  }
}
