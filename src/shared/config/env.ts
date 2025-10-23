import dotenv from 'dotenv';

dotenv.config();

function getEnvVariable(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (!value && defaultValue !== undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid number for environment variable: ${key}`);
  }
  return parsed;
}

export const config = {
  telegram: {
    botToken: getEnvVariable('BOT_TOKEN'),
  },
  database: {
    url: getEnvVariable('DATABASE_URL'),
  },
  redis: {
    url: getEnvVariable('REDIS_URL', 'redis://localhost:6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: getEnvNumber('REDIS_DB', 0),
  },
  app: {
    nodeEnv: getEnvVariable('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 3000),
    logLevel: getEnvVariable('LOG_LEVEL', 'info'),
  },
  rateLimit: {
    maxClicksPerSecond: getEnvNumber('MAX_CLICKS_PER_SECOND', 10),
    windowSeconds: getEnvNumber('RATE_LIMIT_WINDOW_SECONDS', 1),
  },
  batch: {
    saveIntervalMs: getEnvNumber('BATCH_SAVE_INTERVAL_MS', 5000),
    size: getEnvNumber('BATCH_SIZE', 100),
  },
  leaderboard: {
    updateIntervalMs: getEnvNumber('LEADERBOARD_UPDATE_INTERVAL_MS', 500),
    size: getEnvNumber('LEADERBOARD_SIZE', 100),
  },
  session: {
    timeoutMs: getEnvNumber('SESSION_TIMEOUT_MS', 3600000),
  },
  worker: {
    concurrency: getEnvNumber('WORKER_CONCURRENCY', 5),
    maxRetries: getEnvNumber('WORKER_MAX_RETRIES', 3),
  },
} as const;
