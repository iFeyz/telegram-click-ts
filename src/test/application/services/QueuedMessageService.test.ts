import { QueuedMessageService } from '../../../application/services/QueuedMessageService';
import type { MessageQueueService } from '../../../application/services/MessageQueueService';
import { ActionChannel } from '../../../domain/value-objects/ActionChannel';
import { InlineKeyboard } from 'grammy';
import { logger } from '../../../infrastructure/observability/logger';

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  },
}));

describe('QueuedMessageService', () => {
  let service: QueuedMessageService;
  let mockMessageQueue: jest.Mocked<MessageQueueService>;

  beforeEach(() => {
    mockMessageQueue = {
      queueMessage: jest.fn(),
      queueAction: jest.fn(),
      getQueueStats: jest.fn(),
      clearQueue: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<MessageQueueService>;

    service = new QueuedMessageService(mockMessageQueue);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should queue a basic message', async () => {
      const chatId = 'chat-123';
      const message = 'Hello, world!';

      await service.sendMessage(chatId, message);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, undefined, 0, undefined);
    });

    it('should queue message with HTML parse mode', async () => {
      const chatId = 'chat-123';
      const message = '<b>Bold text</b>';
      const options = { parse_mode: 'HTML' as const };

      await service.sendMessage(chatId, message, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, options, 0, undefined);
    });

    it('should queue message with Markdown parse mode', async () => {
      const chatId = 'chat-123';
      const message = '*Bold text*';
      const options = { parse_mode: 'Markdown' as const };

      await service.sendMessage(chatId, message, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, options, 0, undefined);
    });

    it('should queue message with inline keyboard', async () => {
      const chatId = 'chat-123';
      const message = 'Choose an option';
      const keyboard = new InlineKeyboard().text('Option 1', 'opt_1');
      const options = { reply_markup: keyboard };

      await service.sendMessage(chatId, message, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, options, 0, undefined);
    });

    it('should queue message with action channel', async () => {
      const chatId = 'chat-123';
      const message = 'Stats updated';
      const channel = ActionChannel.replaceable('Social', 'stats');

      await service.sendMessage(chatId, message, undefined, channel);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, undefined, 0, channel);
    });

    it('should handle errors gracefully', async () => {
      const chatId = 'chat-123';
      const message = 'Test message';

      mockMessageQueue.queueMessage.mockRejectedValueOnce(new Error('Queue full'));

      await service.sendMessage(chatId, message);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to queue message',
          chatId,
        }),
      );
    });

    it('should not throw errors when queueing fails', async () => {
      mockMessageQueue.queueMessage.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.sendMessage('chat-123', 'Test')).resolves.not.toThrow();
    });
  });

  describe('sendPriorityMessage', () => {
    it('should queue message with high priority', async () => {
      const chatId = 'chat-123';
      const message = 'Urgent message';

      await service.sendPriorityMessage(chatId, message);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        message,
        { reply_markup: undefined },
        10,
        undefined,
      );
    });

    it('should queue priority message with options', async () => {
      const chatId = 'chat-123';
      const message = 'Important update';
      const keyboard = new InlineKeyboard().text('OK', 'ok');
      const options = { parse_mode: 'HTML' as const, reply_markup: keyboard };

      await service.sendPriorityMessage(chatId, message, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        message,
        { parse_mode: 'HTML', reply_markup: keyboard },
        10,
        undefined,
      );
    });

    it('should queue priority message with force_reply', async () => {
      const chatId = 'chat-123';
      const message = 'Enter your name:';
      const options = {
        reply_markup: { force_reply: true, input_field_placeholder: 'Type here...' },
      };

      await service.sendPriorityMessage(chatId, message, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        message,
        expect.objectContaining({ reply_markup: expect.anything() }),
        10,
        undefined,
      );
    });

    it('should queue priority message with action channel', async () => {
      const chatId = 'chat-123';
      const message = 'Session refreshed';
      const channel = ActionChannel.replaceable('Game', 'session');

      await service.sendPriorityMessage(chatId, message, undefined, channel);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        message,
        { reply_markup: undefined },
        10,
        channel,
      );
    });

    it('should handle priority queueing errors gracefully', async () => {
      const chatId = 'chat-123';
      const message = 'Priority test';

      mockMessageQueue.queueMessage.mockRejectedValueOnce(new Error('Queue error'));

      await service.sendPriorityMessage(chatId, message);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to queue priority message',
          chatId,
        }),
      );
    });
  });

  describe('sendNotification', () => {
    it('should queue notification message with low priority', async () => {
      const chatId = 'chat-123';
      const message = 'You have a new message!';

      await service.sendNotification(chatId, message);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, undefined, -1, undefined);
    });

    it('should queue notification with options', async () => {
      const chatId = 'chat-123';
      const message = '<b>New achievement!</b>';
      const options = { parse_mode: 'HTML' as const };

      await service.sendNotification(chatId, message, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, options, -1, undefined);
    });

    it('should handle notification errors gracefully', async () => {
      const chatId = 'chat-123';
      const message = 'Notification test';

      mockMessageQueue.queueMessage.mockRejectedValueOnce(new Error('Failed'));

      await service.sendNotification(chatId, message);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to queue notification',
          chatId,
        }),
      );
    });
  });

  describe('broadcastMessage', () => {
    beforeEach(() => {
      mockMessageQueue.broadcastMessage = jest.fn();
    });

    it('should broadcast message to multiple chats', async () => {
      const chatIds = ['chat-1', 'chat-2', 'chat-3'];
      const message = 'System announcement';

      await service.broadcastMessage(chatIds, message);

      expect(mockMessageQueue.broadcastMessage).toHaveBeenCalledWith(chatIds, message, undefined);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Broadcasting message',
          userCount: 3,
        }),
      );
    });

    it('should broadcast with options', async () => {
      const chatIds = ['chat-1', 'chat-2'];
      const message = '<b>Important update</b>';
      const options = { parse_mode: 'HTML' as const };

      await service.broadcastMessage(chatIds, message, options);

      expect(mockMessageQueue.broadcastMessage).toHaveBeenCalledWith(chatIds, message, options);
    });
  });

  describe('sendLeaderboardUpdate', () => {
    it('should queue leaderboard update with specific priority', async () => {
      const chatId = 'chat-123';
      const leaderboard = 'Top Players:\n1. Player1 - 1000pts';

      await service.sendLeaderboardUpdate(chatId, leaderboard);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        leaderboard,
        undefined,
        -2,
        undefined,
      );
    });

    it('should queue leaderboard with HTML formatting', async () => {
      const chatId = 'chat-123';
      const leaderboard = '<b>Leaderboard</b>';
      const options = { parse_mode: 'HTML' as const };

      await service.sendLeaderboardUpdate(chatId, leaderboard, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, leaderboard, options, -2, undefined);
    });

    it('should handle leaderboard update errors gracefully', async () => {
      mockMessageQueue.queueMessage.mockRejectedValueOnce(new Error('Failed'));

      await service.sendLeaderboardUpdate('chat-123', 'Leaderboard');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to queue leaderboard update',
          chatId: 'chat-123',
        }),
      );
    });
  });

  describe('sendError', () => {
    it('should queue error message with HTML formatting', async () => {
      const chatId = 'chat-123';
      const errorMessage = 'Something went wrong';

      await service.sendError(chatId, errorMessage);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        `❌ <b>Error</b>\n\n${errorMessage}`,
        { parse_mode: 'HTML' },
        5,
        undefined,
      );
    });

    it('should queue error with keyboard options', async () => {
      const chatId = 'chat-123';
      const errorMessage = 'Network error';
      const keyboard = new InlineKeyboard().text('Retry', 'retry');
      const options = { reply_markup: keyboard };

      await service.sendError(chatId, errorMessage, options);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        `❌ <b>Error</b>\n\n${errorMessage}`,
        { reply_markup: keyboard, parse_mode: 'HTML' },
        5,
        undefined,
      );
    });

    it('should handle error message failures gracefully', async () => {
      mockMessageQueue.queueMessage.mockRejectedValueOnce(new Error('Failed'));

      await service.sendError('chat-123', 'Test error');

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to send error message',
          chatId: 'chat-123',
        }),
      );
    });
  });

  describe('queueNavigationAction', () => {
    beforeEach(() => {
      mockMessageQueue.queueAction = jest.fn();
    });

    it('should queue navigation action', async () => {
      const chatId = 'chat-123';
      const action = jest.fn(async () => {});
      const description = 'Navigate to menu';

      await service.queueNavigationAction(chatId, action, description);

      expect(mockMessageQueue.queueAction).toHaveBeenCalledWith(chatId, action, description, 0, undefined);
    });

    it('should queue action with priority', async () => {
      const chatId = 'chat-123';
      const action = jest.fn(async () => {});
      const description = 'Important navigation';
      const priority = 10;

      await service.queueNavigationAction(chatId, action, description, priority);

      expect(mockMessageQueue.queueAction).toHaveBeenCalledWith(chatId, action, description, 10, undefined);
    });

    it('should queue action without description', async () => {
      const chatId = 'chat-123';
      const action = jest.fn(async () => {});

      await service.queueNavigationAction(chatId, action);

      expect(mockMessageQueue.queueAction).toHaveBeenCalledWith(chatId, action, '', 0, undefined);
    });

    it('should handle action queueing errors gracefully', async () => {
      mockMessageQueue.queueAction.mockRejectedValueOnce(new Error('Failed'));

      await service.queueNavigationAction('chat-123', async () => {});

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to queue action',
          chatId: 'chat-123',
        }),
      );
    });
  });

  describe('queueMessageEdit', () => {
    beforeEach(() => {
      mockMessageQueue.queueEdit = jest.fn();
    });

    it('should queue message edit', async () => {
      const chatId = 'chat-123';
      const editAction = jest.fn(async () => {});
      const description = 'Edit message';

      await service.queueMessageEdit(chatId, editAction, description);

      expect(mockMessageQueue.queueEdit).toHaveBeenCalledWith(chatId, editAction, description, 0, undefined);
    });

    it('should queue edit with priority', async () => {
      const chatId = 'chat-123';
      const editAction = jest.fn(async () => {});
      const description = 'Update score';
      const priority = 5;

      await service.queueMessageEdit(chatId, editAction, description, priority);

      expect(mockMessageQueue.queueEdit).toHaveBeenCalledWith(chatId, editAction, description, 5, undefined);
    });

    it('should handle edit errors gracefully', async () => {
      mockMessageQueue.queueEdit.mockRejectedValueOnce(new Error('Failed'));

      await service.queueMessageEdit('chat-123', async () => {});

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to queue edit',
          chatId: 'chat-123',
        }),
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockStats = {
        waiting: 10,
        active: 2,
        completed: 100,
        failed: 5,
        delayed: 0,
        paused: 0,
      };

      mockMessageQueue.getQueueStats.mockResolvedValueOnce(mockStats);

      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        waiting: 10,
        active: 2,
        completed: 100,
        failed: 5,
      });
      expect(mockMessageQueue.getQueueStats).toHaveBeenCalled();
    });

    it('should handle empty queue', async () => {
      const mockStats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };

      mockMessageQueue.getQueueStats.mockResolvedValueOnce(mockStats);

      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      });
    });
  });

  describe('isUnderHeavyLoad', () => {
    it('should return true when queue has more than 100 waiting', async () => {
      mockMessageQueue.getQueueStats.mockResolvedValueOnce({
        waiting: 150,
        active: 5,
        completed: 1000,
        failed: 10,
        delayed: 0,
        paused: 0,
      });

      const result = await service.isUnderHeavyLoad();

      expect(result).toBe(true);
    });

    it('should return false when queue has 100 or fewer waiting', async () => {
      mockMessageQueue.getQueueStats.mockResolvedValueOnce({
        waiting: 100,
        active: 5,
        completed: 1000,
        failed: 10,
        delayed: 0,
        paused: 0,
      });

      const result = await service.isUnderHeavyLoad();

      expect(result).toBe(false);
    });

    it('should return false when queue is empty', async () => {
      mockMessageQueue.getQueueStats.mockResolvedValueOnce({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      });

      const result = await service.isUnderHeavyLoad();

      expect(result).toBe(false);
    });
  });

  describe('pauseNonCritical', () => {
    beforeEach(() => {
      mockMessageQueue.pause = jest.fn();
    });

    it('should pause message queue', async () => {
      await service.pauseNonCritical();

      expect(mockMessageQueue.pause).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Paused non-critical messages due to high load',
        }),
      );
    });
  });

  describe('resume', () => {
    beforeEach(() => {
      mockMessageQueue.resume = jest.fn();
    });

    it('should resume message queue', async () => {
      await service.resume();

      expect(mockMessageQueue.resume).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Resumed message processing',
        }),
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid message queueing', async () => {
      const chatId = 'chat-123';
      const messages = Array.from({ length: 10 }, (_, i) => `Message ${i + 1}`);

      await Promise.all(messages.map((msg) => service.sendMessage(chatId, msg)));

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledTimes(10);
    });

    it('should handle mixed priority messages', async () => {
      const chatId = 'chat-123';

      await service.sendMessage(chatId, 'Normal message');
      await service.sendPriorityMessage(chatId, 'Priority message');
      await service.sendNotification(chatId, 'Notification');

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledTimes(3);
      expect(mockMessageQueue.queueMessage).toHaveBeenNthCalledWith(
        1,
        chatId,
        'Normal message',
        undefined,
        0,
        undefined,
      );
      expect(mockMessageQueue.queueMessage).toHaveBeenNthCalledWith(
        2,
        chatId,
        'Priority message',
        { reply_markup: undefined },
        10,
        undefined,
      );
      expect(mockMessageQueue.queueMessage).toHaveBeenNthCalledWith(
        3,
        chatId,
        'Notification',
        undefined,
        -1,
        undefined,
      );
    });

    it('should preserve action channels across calls', async () => {
      const chatId = 'chat-123';
      const channel1 = ActionChannel.replaceable('Social', 'stats');
      const channel2 = ActionChannel.replaceable('Social', 'leaderboard');

      await service.sendMessage(chatId, 'Message 1', undefined, channel1);
      await service.sendMessage(chatId, 'Message 2', undefined, channel2);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        'Message 1',
        undefined,
        0,
        channel1,
      );
      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(
        chatId,
        'Message 2',
        undefined,
        0,
        channel2,
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty message strings', async () => {
      const chatId = 'chat-123';
      const message = '';

      await service.sendMessage(chatId, message);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, '', undefined, 0, undefined);
    });

    it('should handle very long messages', async () => {
      const chatId = 'chat-123';
      const message = 'A'.repeat(10000);

      await service.sendMessage(chatId, message);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, undefined, 0, undefined);
    });

    it('should handle special characters in messages', async () => {
      const chatId = 'chat-123';
      const message = '🎉 Special: <>&"\'';

      await service.sendMessage(chatId, message);

      expect(mockMessageQueue.queueMessage).toHaveBeenCalledWith(chatId, message, undefined, 0, undefined);
    });

    it('should handle concurrent errors without throwing', async () => {
      const chatId = 'chat-123';
      mockMessageQueue.queueMessage.mockRejectedValue(new Error('Always fail'));

      const promises = [
        service.sendMessage(chatId, 'Message 1'),
        service.sendPriorityMessage(chatId, 'Message 2'),
        service.sendNotification(chatId, 'Message 3'),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});
