import pino from 'pino';
import { observabilityConfig } from '../../shared/config/observability';

const targets: pino.TransportTargetOptions[] = [];

if (observabilityConfig.logging.pretty) {
  targets.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
    level: observabilityConfig.logging.level,
  });
}

if (observabilityConfig.loki.enabled) {
  targets.push({
    target: 'pino-loki',
    options: {
      batching: true,
      interval: 5,
      host: observabilityConfig.loki.url,
      labels: { app: 'telegram-bot' },
    },
    level: observabilityConfig.logging.level,
  });
}

if (targets.length === 0) {
  targets.push({
    target: 'pino/file',
    options: { destination: 1 },
    level: observabilityConfig.logging.level,
  });
}

export const logger = pino({
  level: observabilityConfig.logging.level,
  transport: {
    targets,
  },
  base: {
    service: 'telegram-bot',
    env: observabilityConfig.logging.pretty ? 'development' : 'production',
  },
});
