import './instrumentation';
import 'dotenv/config';
import { container } from './shared/container/DIContainer';
import {
  startMetricsServer,
  stopMetricsServer,
} from './infrastructure/observability/metricsServer';

async function main(): Promise<void> {
  try {
    console.log('Starting Telegram Clicker Bot');

    startMetricsServer();
    await container.initialize();

    console.log('Bot started successfully!');

    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully');
      stopMetricsServer();
      await container.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down gracefully');
      stopMetricsServer();
      await container.cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

void main();
