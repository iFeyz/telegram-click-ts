/**
 * Application constants
 */

export const TELEGRAM_LIMITS = {
  MESSAGE_LENGTH: 4096,
  CAPTION_LENGTH: 1024,
  INLINE_QUERY_RESULTS: 50,
  CALLBACK_DATA_LENGTH: 64,

  MESSAGES_PER_SECOND_GLOBAL: 30,
  MESSAGES_PER_SECOND_PER_CHAT: 1,
  MESSAGES_PER_MINUTE_PER_CHAT: 20,
  MESSAGES_PER_HOUR: 1000,

  MAX_RECIPIENTS_PER_BROADCAST: 30,
  BROADCAST_DELAY_MS: 50,
} as const;

export const GAME_SETTINGS = {
  MIN_CLICK_COUNT: 1,
  MAX_CLICK_COUNT: 100,
  MAX_CLICKS_PER_SECOND: 10,
  CLICK_COOLDOWN_MS: 100,
  SESSION_TIMEOUT_MS: 3600000,
  BATCH_SAVE_INTERVAL_MS: 5000,
  LEADERBOARD_SIZE: 100,
  LEADERBOARD_CACHE_TTL_MS: 500,
} as const;

export const BOT_COMMANDS = [
  { command: 'start', description: '🚀 Start the game' },
  { command: 'click', description: '👆 Click to earn points' },
  { command: 'leaderboard', description: '🏆 View top players' },
  { command: 'stats', description: '📊 View your statistics' },
  { command: 'changename', description: '✏️ Change your display name' },
  { command: 'help', description: '❓ Show help information' },
] as const;

export const EMOJIS = {
  CLICK: '👆',
  TROPHY: '🏆',
  FIRE: '🔥',
  STAR: '⭐',
  ROCKET: '🚀',
  MEDAL_GOLD: '🥇',
  MEDAL_SILVER: '🥈',
  MEDAL_BRONZE: '🥉',
  UP_ARROW: '⬆️',
  DOWN_ARROW: '⬇️',
  NEW: '🆕',
  CROWN: '👑',
  SPARKLES: '✨',
  PARTY: '🎉',
  WARNING: '⚠️',
  ERROR: '❌',
  SUCCESS: '✅',
  INFO: 'ℹ️',
} as const;

export const REDIS_KEYS = {
  CLICK_PENDING: 'clicks:pending:',
  CLICK_STREAM: 'clicks:stream',
  LEADERBOARD: 'leaderboard:global',
  LEADERBOARD_USER: 'leaderboard:user:',
  SESSION: 'session:',
  RATE_LIMIT: 'ratelimit:',
  USER_CACHE: 'cache:user:',
  STATS_CACHE: 'cache:stats:',
} as const;

export const ERROR_MESSAGES = {
  RATE_LIMIT: 'Slow down! You are clicking too fast. Please wait a moment.',
  SESSION_EXPIRED: 'Your session has expired. Please use /start to begin again.',
  INVALID_CLICK: 'Invalid click detected. Please try again.',
  DATABASE_ERROR: 'Something went wrong. Please try again later.',
  NOT_FOUND: 'User not found. Please use /start to register.',
  TELEGRAM_ERROR: 'Failed to send message. Please try again.',
} as const;
