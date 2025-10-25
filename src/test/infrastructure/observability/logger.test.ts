import { logger } from '../../../infrastructure/observability/logger';
import { observabilityConfig } from '../../../shared/config/observability';

describe('logger', () => {
  describe('logger instance', () => {
    it('should be defined', () => {
      expect(logger).toBeDefined();
    });

    it('should have standard logging methods', () => {
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.trace).toBeDefined();
      expect(logger.fatal).toBeDefined();
    });

    it('should have level configured', () => {
      expect(logger.level).toBeDefined();
      expect(typeof logger.level).toBe('string');
    });

    it('should match configured log level', () => {
      expect(logger.level).toBe(observabilityConfig.logging.level);
    });
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should log error messages', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should log warn messages', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('should log debug messages', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });

    it('should log trace messages', () => {
      expect(() => {
        logger.trace('Test trace message');
      }).not.toThrow();
    });

    it('should log fatal messages', () => {
      expect(() => {
        logger.fatal('Test fatal message');
      }).not.toThrow();
    });
  });

  describe('structured logging', () => {
    it('should log with context object', () => {
      expect(() => {
        logger.info({ userId: '123', action: 'click' }, 'User action');
      }).not.toThrow();
    });

    it('should log with error object', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error({ err: error }, 'Error occurred');
      }).not.toThrow();
    });

    it('should log with multiple fields', () => {
      expect(() => {
        logger.info(
          {
            userId: '123',
            command: '/start',
            chatType: 'private',
            timestamp: Date.now(),
          },
          'Command executed',
        );
      }).not.toThrow();
    });

    it('should log with nested objects', () => {
      expect(() => {
        logger.info(
          {
            user: {
              id: '123',
              username: 'testuser',
            },
            session: {
              id: 'session-123',
              startTime: new Date(),
            },
          },
          'Session started',
        );
      }).not.toThrow();
    });

    it('should handle null and undefined values', () => {
      expect(() => {
        logger.info({ nullValue: null, undefinedValue: undefined }, 'Test message');
      }).not.toThrow();
    });
  });

  describe('message formatting', () => {
    it('should log string messages', () => {
      expect(() => {
        logger.info('Simple string message');
      }).not.toThrow();
    });

    it('should handle empty strings', () => {
      expect(() => {
        logger.info('');
      }).not.toThrow();
    });

    it('should handle long messages', () => {
      const longMessage = 'x'.repeat(10000);
      expect(() => {
        logger.info(longMessage);
      }).not.toThrow();
    });

    it('should handle special characters', () => {
      expect(() => {
        logger.info('Special chars: \n\t\r\'"\\');
      }).not.toThrow();
    });

    it('should handle unicode characters', () => {
      expect(() => {
        logger.info('Unicode: 🚀 测试 مرحبا');
      }).not.toThrow();
    });
  });

  describe('child logger', () => {
    it('should create child logger', () => {
      const child = logger.child({ component: 'test' });
      expect(child).toBeDefined();
      expect(child.info).toBeDefined();
    });

    it('should inherit parent configuration', () => {
      const child = logger.child({ component: 'test' });
      expect(child.level).toBe(logger.level);
    });

    it('should add context to child logger', () => {
      expect(() => {
        const child = logger.child({ service: 'telegram-bot', component: 'handler' });
        child.info('Child logger message');
      }).not.toThrow();
    });

    it('should create nested child loggers', () => {
      expect(() => {
        const child1 = logger.child({ layer: 'application' });
        const child2 = child1.child({ component: 'handler' });
        child2.info('Nested child logger message');
      }).not.toThrow();
    });
  });

  describe('error logging', () => {
    it('should log Error objects', () => {
      const error = new Error('Test error');
      expect(() => {
        logger.error(error);
      }).not.toThrow();
    });

    it('should log error with context', () => {
      const error = new Error('Database connection failed');
      expect(() => {
        logger.error({ err: error, operation: 'connect', database: 'postgres' }, 'DB Error');
      }).not.toThrow();
    });

    it('should log error stack trace', () => {
      const error = new Error('Error with stack');
      error.stack = 'Error: Error with stack\n    at test.ts:1:1';
      expect(() => {
        logger.error({ err: error });
      }).not.toThrow();
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: string,
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error message', 'CUSTOM_001');
      expect(() => {
        logger.error({ err: error, code: error.code }, 'Custom error occurred');
      }).not.toThrow();
    });
  });

  describe('performance', () => {
    it('should handle rapid consecutive logs', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          logger.info(`Message ${i}`);
        }
      }).not.toThrow();
    });

    it('should handle concurrent logging', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            logger.info({ iteration: i }, 'Concurrent log');
          }),
        );
      }

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle large context objects', () => {
      const largeContext = {
        data: Array(1000)
          .fill(0)
          .map((_, i) => ({ id: i, value: `value-${i}` })),
      };

      expect(() => {
        logger.info(largeContext, 'Large context');
      }).not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should respect log level configuration', () => {
      const currentLevel = logger.level;
      expect(currentLevel).toBe(observabilityConfig.logging.level);
    });

    it('should have base metadata', () => {
      expect(() => {
        logger.info('Test base metadata');
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle circular references', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      expect(() => {
        logger.info({ circular }, 'Circular reference test');
      }).not.toThrow();
    });

    it('should handle very deep nested objects', () => {
      let deep: Record<string, unknown> = { level: 0 };
      let current = deep;

      for (let i = 1; i < 100; i++) {
        current.next = { level: i };
        current = current.next as Record<string, unknown>;
      }

      expect(() => {
        logger.info({ deep }, 'Deep nesting test');
      }).not.toThrow();
    });

    it('should handle symbols in context', () => {
      const sym = Symbol('test');
      expect(() => {
        logger.info({ [sym]: 'symbol value' } as Record<string, unknown>, 'Symbol test');
      }).not.toThrow();
    });

    it('should handle functions in context', () => {
      expect(() => {
        logger.info({ fn: () => 'test' } as Record<string, unknown>, 'Function test');
      }).not.toThrow();
    });

    it('should handle dates in context', () => {
      expect(() => {
        logger.info({ timestamp: new Date(), created: new Date('2025-01-01') }, 'Date test');
      }).not.toThrow();
    });

    it('should handle buffers in context', () => {
      const buffer = Buffer.from('test data');
      expect(() => {
        logger.info({ buffer }, 'Buffer test');
      }).not.toThrow();
    });
  });

  describe('real-world scenarios', () => {
    it('should log bot lifecycle events', () => {
      expect(() => {
        logger.info('Bot started');
        logger.info({ port: 9464 }, 'Metrics server started');
        logger.info({ database: 'postgres', redis: 'localhost:6379' }, 'Connected to services');
      }).not.toThrow();
    });

    it('should log user interactions', () => {
      expect(() => {
        logger.info({ userId: '123', command: '/start', chatType: 'private' }, 'Command received');
        logger.info({ userId: '123', clicks: 5, duration: 100 }, 'Click action completed');
      }).not.toThrow();
    });

    it('should log errors with context', () => {
      const error = new Error('Database query failed');
      expect(() => {
        logger.error(
          {
            err: error,
            query: 'SELECT * FROM users',
            userId: '123',
          },
          'Database error',
        );
      }).not.toThrow();
    });

    it('should log rate limiting events', () => {
      expect(() => {
        logger.warn({ userId: '123', limitType: 'click', attempts: 10 }, 'Rate limit hit');
        logger.info({ userId: '123', limitType: 'click', resetAt: new Date() }, 'Rate limit reset');
      }).not.toThrow();
    });

    it('should log metrics events', () => {
      expect(() => {
        logger.debug({ metric: 'bot_requests_total', value: 1, labels: { command: '/start' } }, 'Metric incremented');
      }).not.toThrow();
    });

    it('should log cache operations', () => {
      expect(() => {
        logger.debug({ operation: 'get', key: 'session:123', hit: true }, 'Cache operation');
        logger.debug({ operation: 'set', key: 'session:123', ttl: 3600 }, 'Cache set');
      }).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should work with all log levels in sequence', () => {
      expect(() => {
        logger.trace('Trace level');
        logger.debug('Debug level');
        logger.info('Info level');
        logger.warn('Warn level');
        logger.error('Error level');
        logger.fatal('Fatal level');
      }).not.toThrow();
    });

    it('should handle mixed logging patterns', () => {
      expect(() => {
        logger.info('Simple message');
        logger.info({ userId: '123' }, 'With context');
        const child = logger.child({ component: 'test' });
        child.info('Child logger');
        logger.error(new Error('Error object'));
      }).not.toThrow();
    });
  });
});
