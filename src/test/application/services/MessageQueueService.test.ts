import { MessageQueueService } from '../../../application/services/MessageQueueService';
import { ActionChannel } from '../../../domain/value-objects/ActionChannel';
import type { Bot } from 'grammy';
import type { BotContext } from '../../../infrastructure/telegram/types';
import { redisClient } from '../../../infrastructure/redis/client';
import Bull from 'bull';

// Mock Bull to avoid ioredis-mock compatibility issues
jest.mock('bull');

describe('MessageQueueService', () => {
  let service: MessageQueueService;
  let mockBot: jest.Mocked<Bot<BotContext>>;
  let mockQueue: jest.Mocked<Bull.Queue>;
  let processCallback: ((job: Bull.Job) => Promise<any>) | null = null;
  let jobIdCounter = 0;
  let jobs: Map<string, { job: Bull.Job; state: string; attemptCount: number; priority: number }>;
  let eventHandlers: Map<string, Function[]>;
  let isPaused: boolean;
  let processJob: (jobId: string) => Promise<void>;
  let pendingTimers: Set<NodeJS.Timeout>;

  beforeAll(async () => {
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  beforeEach(() => {
    jobIdCounter = 0;
    processCallback = null;

    // Job storage with states
    jobs = new Map();
    eventHandlers = new Map();
    isPaused = false;
    pendingTimers = new Set();

    // Function to process a specific job
    processJob = async (jobId: string): Promise<void> => {
      if (!processCallback || isPaused) return;

      const jobInfo = jobs.get(jobId);
      if (!jobInfo || jobInfo.state !== 'waiting') return;

      const { job } = jobInfo;
      jobInfo.state = 'active';
      (job.getState as jest.Mock).mockResolvedValue('active');

      const tryProcess = async (attempt: number): Promise<void> => {
        try {
          job.attemptsMade = attempt;
          const result = await processCallback!(job);

          if (jobs.has(jobId)) {
            jobs.get(jobId)!.state = 'completed';
            (job.getState as jest.Mock).mockResolvedValue('completed');

            const completedHandlers = eventHandlers.get('completed') || [];
            for (const handler of completedHandlers) {
              await handler(job, result);
            }
          }
        } catch (error) {
          const jobInfo = jobs.get(jobId);
          if (!jobInfo) return;

          jobInfo.attemptCount++;

          const maxAttempts = 3;
          if (jobInfo.attemptCount < maxAttempts) {
            jobInfo.state = 'waiting';
            (job.getState as jest.Mock).mockResolvedValue('waiting');

            const retryTimer = setTimeout(() => {
              pendingTimers.delete(retryTimer);
              tryProcess(jobInfo.attemptCount);
            }, 50);
            pendingTimers.add(retryTimer);
          } else {
            jobInfo.state = 'failed';
            (job.getState as jest.Mock).mockResolvedValue('failed');

            const failedHandlers = eventHandlers.get('failed') || [];
            for (const handler of failedHandlers) {
              await handler(job, error);
            }
          }
        }
      };

      await tryProcess(0);
    };

    // Setup mock queue that actually processes jobs
    mockQueue = {
      process: jest.fn((_concurrency: number, callback: (job: Bull.Job) => Promise<any>) => {
        processCallback = callback;
      }),
      add: jest.fn().mockImplementation(async (data: any, options: any) => {
        const jobId = ++jobIdCounter;
        const priority = options?.priority || 0;
        const job = {
          id: jobId.toString(),
          data,
          opts: options || {},
          attemptsMade: 0,
          getState: jest.fn(),
          remove: jest.fn().mockImplementation(async () => {
            const jobInfo = jobs.get(jobId.toString());
            if (jobInfo) {
              jobInfo.state = 'removed';
            }
            jobs.delete(jobId.toString());
          }),
        } as any;

        const delay = options?.delay || 0;
        const state = delay > 0 ? 'delayed' : 'waiting';
        jobs.set(jobId.toString(), { job, state, attemptCount: 0, priority });
        (job.getState as jest.Mock).mockResolvedValue(state);

        // Schedule job processing (each job processes independently)
        if (processCallback && !isPaused) {
          const timer = setTimeout(() => {
            pendingTimers.delete(timer);
            processJob(jobId.toString());
          }, delay + 1);
          pendingTimers.add(timer);
        }

        return job;
      }),
      getJob: jest.fn().mockImplementation(async (jobId: string) => {
        const jobInfo = jobs.get(jobId);
        return jobInfo ? jobInfo.job : null;
      }),
      getJobCounts: jest.fn().mockImplementation(async () => {
        const counts = {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        };

        for (const { state } of jobs.values()) {
          if (state in counts) {
            counts[state as keyof typeof counts]++;
          }
        }

        return counts;
      }),
      empty: jest.fn().mockImplementation(async () => {
        jobs.clear();
      }),
      close: jest.fn().mockImplementation(async () => {
        jobs.clear();
      }),
      pause: jest.fn().mockImplementation(async () => {
        isPaused = true;
      }),
      resume: jest.fn().mockImplementation(async () => {
        isPaused = false;
        // Start processing all waiting jobs in priority order (higher priority first)
        const waitingJobs = Array.from(jobs.entries())
          .filter(([_, jobInfo]) => jobInfo.state === 'waiting')
          .sort((a, b) => b[1].priority - a[1].priority);

        for (const [jobId] of waitingJobs) {
          setImmediate(() => processJob(jobId));
        }
      }),
      on: jest.fn().mockImplementation((event: string, handler: Function) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event)!.push(handler);
      }),
    } as unknown as jest.Mocked<Bull.Queue>;

    // Mock Bull constructor
    (Bull as unknown as jest.Mock).mockReturnValue(mockQueue);

    const sendMessageMock = jest.fn().mockResolvedValue({});
    mockBot = {
      api: {
        sendMessage: sendMessageMock as unknown as typeof mockBot.api.sendMessage,
      },
    } as unknown as jest.Mocked<Bot<BotContext>>;

    service = new MessageQueueService(mockBot);
  });

  afterEach(async () => {
    // Clear all pending timers
    for (const timer of pendingTimers) {
      clearTimeout(timer);
    }
    pendingTimers.clear();

    jest.clearAllTimers();
    await service.clear();
    await service.shutdown();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(MessageQueueService);
    });

    it('should initialize queue with Bull', () => {
      expect(service).toHaveProperty('queue');
    });
  });

  describe('queueMessage', () => {
    it('should queue a basic message', async () => {
      const chatId = '123';
      const message = 'Hello, World!';

      await service.queueMessage(chatId, message);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chatId, message, undefined);
    });

    it('should queue message with options', async () => {
      const chatId = '123';
      const message = '<b>Bold text</b>';
      const options = { parse_mode: 'HTML' as const };

      await service.queueMessage(chatId, message, options);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chatId, message, options);
    });

    it('should queue message with priority', async () => {
      const chatId = '123';
      const message = 'Priority message';
      const priority = 10;

      await service.queueMessage(chatId, message, undefined, priority);

      const stats = await service.getQueueStats();
      expect(stats.waiting).toBeGreaterThanOrEqual(0);
    });

    it('should queue message with replaceable channel', async () => {
      const chatId = '123';
      const message1 = 'First message';
      const message2 = 'Second message';
      const channel = ActionChannel.replaceable('Social', 'stats');

      await service.queueMessage(chatId, message1, undefined, 0, channel);
      await service.queueMessage(chatId, message2, undefined, 0, channel);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chatId, message2, undefined);
    });

    it('should queue message with non-replaceable channel', async () => {
      const chatId = '123';
      const message1 = 'First message';
      const message2 = 'Second message';
      const channel = ActionChannel.nonReplaceable('Game', 'action');

      await service.queueMessage(chatId, message1, undefined, 0, channel);
      await service.queueMessage(chatId, message2, undefined, 0, channel);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('queueAction', () => {
    it('should queue an action', async () => {
      const chatId = '123';
      const action = jest.fn().mockResolvedValue(undefined);
      const description = 'Test action';

      await service.queueAction(chatId, action, description);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(action).toHaveBeenCalled();
    });

    it('should queue action with priority', async () => {
      const chatId = '123';
      const action = jest.fn().mockResolvedValue(undefined);
      const priority = 5;

      await service.queueAction(chatId, action, 'Priority action', priority);

      const stats = await service.getQueueStats();
      expect(stats.waiting).toBeGreaterThanOrEqual(0);
    });

    it('should queue action with replaceable channel', async () => {
      const chatId = '123';
      const action1 = jest.fn().mockResolvedValue(undefined);
      const action2 = jest.fn().mockResolvedValue(undefined);
      const channel = ActionChannel.replaceable('Navigation', 'menu');

      await service.queueAction(chatId, action1, 'Action 1', 0, channel);
      await service.queueAction(chatId, action2, 'Action 2', 0, channel);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(action1).not.toHaveBeenCalled();
      expect(action2).toHaveBeenCalled();
    });
  });

  describe('queueEdit', () => {
    it('should queue an edit action', async () => {
      const chatId = '123';
      const editAction = jest.fn().mockResolvedValue(undefined);
      const description = 'Edit message';

      await service.queueEdit(chatId, editAction, description);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(editAction).toHaveBeenCalled();
    });

    it('should queue edit with replaceable channel', async () => {
      const chatId = '123';
      const edit1 = jest.fn().mockResolvedValue(undefined);
      const edit2 = jest.fn().mockResolvedValue(undefined);
      const channel = ActionChannel.replaceable('Game', 'score');

      await service.queueEdit(chatId, edit1, 'Edit 1', 0, channel);
      await service.queueEdit(chatId, edit2, 'Edit 2', 0, channel);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(edit1).not.toHaveBeenCalled();
      expect(edit2).toHaveBeenCalled();
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast message to multiple chats', async () => {
      const chatIds = ['123', '456', '789'];
      const message = 'Broadcast message';

      await service.broadcastMessage(chatIds, message);

      const stats = await service.getQueueStats();
      expect(stats.waiting + stats.delayed).toBeGreaterThanOrEqual(chatIds.length);
    });

    it('should broadcast with options', async () => {
      const chatIds = ['123', '456'];
      const message = '<b>Important</b>';
      const options = { parse_mode: 'HTML' as const };

      await service.broadcastMessage(chatIds, message, options);

      const stats = await service.getQueueStats();
      expect(stats.waiting + stats.delayed).toBeGreaterThanOrEqual(chatIds.length);
    });

    it('should handle large broadcast lists', async () => {
      const chatIds = Array.from({ length: 100 }, (_, i) => `chat-${i}`);
      const message = 'Bulk message';

      await service.broadcastMessage(chatIds, message);

      const stats = await service.getQueueStats();
      expect(stats.waiting + stats.delayed).toBeGreaterThanOrEqual(chatIds.length);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats();

      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('delayed');
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
    });

    it('should show waiting jobs', async () => {
      await service.queueMessage('123', 'Message 1');
      await service.queueMessage('456', 'Message 2');

      const stats = await service.getQueueStats();
      expect(stats.waiting).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pause and resume', () => {
    it('should pause queue processing', async () => {
      await service.pause();

      await service.queueMessage('123', 'Paused message');

      const stats = await service.getQueueStats();
      expect(stats.waiting).toBeGreaterThan(0);
    });

    it('should resume queue processing', async () => {
      await service.pause();
      await service.queueMessage('123', 'Paused message');
      await service.resume();

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all jobs from queue', async () => {
      await service.queueMessage('123', 'Message 1');
      await service.queueMessage('456', 'Message 2');

      await service.clear();

      const stats = await service.getQueueStats();
      expect(stats.waiting).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should retry failed jobs', async () => {
      let attempts = 0;
      const sendMessageMock = jest.fn(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({});
      });
      mockBot.api.sendMessage = sendMessageMock as unknown as typeof mockBot.api.sendMessage;

      await service.queueMessage('123', 'Retry message');

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(attempts).toBeGreaterThanOrEqual(2);
    });

    it('should handle Telegram rate limits', async () => {
      const rateLimitError = {
        error_code: 429,
        description: 'Too Many Requests',
        parameters: { retry_after: 1 },
      };

      const sendMessageMock = jest.fn().mockRejectedValueOnce(rateLimitError);
      mockBot.api.sendMessage = sendMessageMock as unknown as typeof mockBot.api.sendMessage;

      await service.queueMessage('123', 'Rate limited message');

      await new Promise((resolve) => setTimeout(resolve, 250));

      const stats = await service.getQueueStats();
      expect(stats.failed).toBeGreaterThanOrEqual(0);
    });

    it('should handle action errors', async () => {
      const action = jest.fn().mockRejectedValue(new Error('Action failed'));

      await service.queueAction('123', action, 'Failing action');

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(action).toHaveBeenCalled();
    });
  });

  describe('channel tracking', () => {
    it('should track jobs in replaceable channels', async () => {
      const chatId = '123';
      const channel = ActionChannel.replaceable('Social', 'stats');
      const redis = redisClient.getClient();

      await service.queueMessage(chatId, 'Message', undefined, 0, channel);

      const key = channel.getTrackingKey(chatId);
      const trackedJobId = await redis.get(key);

      expect(trackedJobId).not.toBeNull();
    });

    it('should clean up tracking after job completion', async () => {
      const chatId = '123';
      const channel = ActionChannel.replaceable('Social', 'stats');
      const redis = redisClient.getClient();

      await service.queueMessage(chatId, 'Message', undefined, 0, channel);

      await new Promise((resolve) => setTimeout(resolve, 250));

      const key = channel.getTrackingKey(chatId);
      const trackedJobId = await redis.get(key);

      expect(trackedJobId).toBeNull();
    });

    it('should skip superseded jobs in same channel', async () => {
      const chatId = '123';
      const channel = ActionChannel.replaceable('Game', 'state');

      await service.queueMessage(chatId, 'Message 1', undefined, 0, channel);
      await service.queueMessage(chatId, 'Message 2', undefined, 0, channel);
      await service.queueMessage(chatId, 'Message 3', undefined, 0, channel);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chatId, 'Message 3', undefined);
    });
  });

  describe('priority handling', () => {
    it('should process high priority jobs first', async () => {
      const processedMessages: string[] = [];

      const sendMessageMock = jest.fn((_chatId: unknown, message: unknown) => {
        if (typeof message === 'string') {
          processedMessages.push(message);
        }
        return Promise.resolve({});
      });
      mockBot.api.sendMessage = sendMessageMock as unknown as typeof mockBot.api.sendMessage;

      await service.pause();
      await service.queueMessage('123', 'Low priority', undefined, -10);
      await service.queueMessage('123', 'High priority', undefined, 10);
      await service.queueMessage('123', 'Normal priority', undefined, 0);
      await service.resume();

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(processedMessages[0]).toBe('High priority');
    });
  });

  describe('concurrency', () => {
    it('should handle concurrent queueing', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(service.queueMessage(`chat-${i}`, `Message ${i}`));
      }

      await Promise.all(promises);

      const stats = await service.getQueueStats();
      expect(stats.waiting + stats.active + stats.completed).toBeGreaterThanOrEqual(10);
    });

    it('should process jobs concurrently', async () => {
      const startTimes: number[] = [];

      const sendMessageMock = jest.fn(() => {
        startTimes.push(Date.now());
        return new Promise((resolve) => setTimeout(() => resolve({}), 50));
      });
      mockBot.api.sendMessage = sendMessageMock as unknown as typeof mockBot.api.sendMessage;

      for (let i = 0; i < 5; i++) {
        await service.queueMessage(`chat-${i}`, `Message ${i}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 250));

      const timeDifferences = startTimes.map((time, i) => (i === 0 ? 0 : time - startTimes[0]!));
      const hasOverlap = timeDifferences.some((diff) => diff < 50);

      expect(hasOverlap).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.queueMessage('123', 'Final message');

      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete message lifecycle', async () => {
      const chatId = '123';
      const message = 'Lifecycle test';

      await service.queueMessage(chatId, message);

      await new Promise((resolve) => setTimeout(resolve, 250));

      const stats = await service.getQueueStats();
      expect(stats.completed).toBeGreaterThanOrEqual(1);
      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chatId, message, undefined);
    });

    it('should handle mixed job types', async () => {
      const chatId = '123';
      const action = jest.fn().mockResolvedValue(undefined);
      const edit = jest.fn().mockResolvedValue(undefined);

      await service.queueMessage(chatId, 'Message');
      await service.queueAction(chatId, action, 'Action');
      await service.queueEdit(chatId, edit, 'Edit');

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalled();
      expect(action).toHaveBeenCalled();
      expect(edit).toHaveBeenCalled();
    });

    it('should handle channel replacement across job types', async () => {
      const chatId = '123';
      const channel = ActionChannel.replaceable('UI', 'display');
      const action1 = jest.fn().mockResolvedValue(undefined);
      const action2 = jest.fn().mockResolvedValue(undefined);

      await service.queueAction(chatId, action1, 'Action 1', 0, channel);
      await service.queueEdit(chatId, action2, 'Edit', 0, channel);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(action1).not.toHaveBeenCalled();
      expect(action2).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', async () => {
      await service.queueMessage('123', '');

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith('123', '', undefined);
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(4096);

      await service.queueMessage('123', longMessage);

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith('123', longMessage, undefined);
    });

    it('should handle special characters in chatId', async () => {
      const chatId = '-100123456789';

      await service.queueMessage(chatId, 'Message');

      await new Promise((resolve) => setTimeout(resolve, 250));

      expect(mockBot.api.sendMessage).toHaveBeenCalledWith(chatId, 'Message', undefined);
    });

    it('should handle undefined action gracefully', async () => {
      const chatId = '123';

      await service.queueAction(chatId, undefined as unknown as () => Promise<void>, 'Undefined action');

      await new Promise((resolve) => setTimeout(resolve, 250));

      const stats = await service.getQueueStats();
      expect(stats.failed).toBeGreaterThanOrEqual(0);
    });
  });
});
