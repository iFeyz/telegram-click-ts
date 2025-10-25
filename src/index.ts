import './instrumentation';
import 'dotenv/config';
import { container } from './shared/container/DIContainer';
import {
  startMetricsServer,
  stopMetricsServer,
} from './infrastructure/observability/metricsServer';
import { logger } from './infrastructure/observability/logger';
import { BotEvents } from './infrastructure/observability/events';

async function main(): Promise<void> {
  try {
    logger.info({ event: BotEvents.BOT_STARTED, message: 'Starting Telegram Clicker Bot' });

    startMetricsServer();
    await container.initialize();

    logger.info({ event: BotEvents.BOT_STARTED, message: 'Bot started successfully!' });

    process.on('SIGINT', async () => {
      logger.info({ event: BotEvents.BOT_STOPPED, message: 'Shutting down gracefully (SIGINT)' });
      stopMetricsServer();
      await container.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info({ event: BotEvents.BOT_STOPPED, message: 'Shutting down gracefully (SIGTERM)' });
      stopMetricsServer();
      await container.cleanup();
      process.exit(0);
    });
  } catch (error) {
    logger.error({
      event: BotEvents.BOT_ERROR,
      message: 'Failed to start bot',
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void main();
