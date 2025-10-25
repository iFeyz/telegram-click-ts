/**
 * Centralized event naming constants for observability tracking
 *
 * Naming Convention:
 * - Format: {entity}.{action}[.{detail}]
 * - Use lowercase with dots as separators
 * - Keep names descriptive but concise
 */

export const BotEvents = {

  BOT_STARTED: 'bot.started',
  BOT_STOPPED: 'bot.stopped',
  BOT_ERROR: 'bot.error',

  
  REQUEST_RECEIVED: 'bot.request',
  REQUEST_COMPLETED: 'bot.response',
  REQUEST_FAILED: 'bot.request.failed',

  
  USER_JOINED: 'user.joined',
  USER_BLOCKED: 'user.blocked',

  
  CLICK_PERFORMED: 'click.performed',
  CLICK_FAILED: 'click.failed',

  
  LEADERBOARD_VIEWED: 'leaderboard.viewed',
  LEADERBOARD_LOADED: 'leaderboard.loaded',

  
  STATS_VIEWED: 'stats.viewed',
  STATS_CALCULATED: 'stats.calculated',

  
  DB_QUERY_SUCCESS: 'db.query.success',
  DB_QUERY_FAILED: 'db.query.failed',

  
  CACHE_HIT: 'cache.hit',
  CACHE_MISS: 'cache.miss',
  CACHE_SET: 'cache.set',
  CACHE_DELETED: 'cache.deleted',

  
  RATE_LIMIT_HIT: 'rate_limit.hit',
  RATE_LIMIT_APPROACHING: 'rate_limit.approaching',
} as const;

export const CommandNames = {
  START: '/start',
  HELP: '/help',
  CLICK: 'click',
  LEADERBOARD: 'leaderboard',
  STATS: 'stats',
  CHANGE_NAME: 'change_name',
  UNKNOWN: 'unknown',
} as const;

export const CallbackActions = {
  CLICK: 'click',
  MENU: 'menu',
  LEADERBOARD: 'leaderboard',
  STATS: 'stats',
  CONFIRM: 'confirm',
  CANCEL: 'cancel',
} as const;

export const CallbackToCommand: Record<string, string> = {
  [CallbackActions.CLICK]: CommandNames.CLICK,
  [CallbackActions.MENU]: CommandNames.START,
  [CallbackActions.LEADERBOARD]: CommandNames.LEADERBOARD,
  [CallbackActions.STATS]: CommandNames.STATS,
};

export function isClickAction(command: string, callbackData?: string): boolean {
  if (command === CommandNames.CLICK) return true;
  if (!callbackData) return false;

  const parts = callbackData.split(':');
  return parts.includes(CallbackActions.CLICK) || parts[parts.length - 1] === CallbackActions.CLICK;
}

export function isLeaderboardAction(command: string, callbackData?: string): boolean {
  if (command === CommandNames.LEADERBOARD) return true;
  if (!callbackData) return false;

  const parts = callbackData.split(':');
  return parts.includes(CallbackActions.LEADERBOARD);
}

export function isStatsAction(command: string, callbackData?: string): boolean {
  if (command === CommandNames.STATS) return true;
  if (!callbackData) return false;

  const parts = callbackData.split(':');
  return parts.includes(CallbackActions.STATS);
}

export function parseCommandName(messageText?: string, callbackData?: string): string {

  if (messageText) {
    const command = messageText.split(' ')[0];
    return command || CommandNames.UNKNOWN;
  }

  
  if (callbackData) {
    const parts = callbackData.split(':');
    const action = parts[0];

    if (!action) {
      return CommandNames.UNKNOWN;
    }

  
    if (action in CallbackToCommand) {
      const mapped = CallbackToCommand[action as keyof typeof CallbackToCommand];
      return mapped || CommandNames.UNKNOWN;
    }

  
    if (parts.length === 1) {
      if (callbackData in CallbackToCommand) {
        const mapped = CallbackToCommand[callbackData as keyof typeof CallbackToCommand];
        return mapped || CommandNames.UNKNOWN;
      }
      return callbackData;
    }

  
    return `callback:${action}`;
  }

  return CommandNames.UNKNOWN;
}

export type BotEvent = (typeof BotEvents)[keyof typeof BotEvents];
export type CommandName = (typeof CommandNames)[keyof typeof CommandNames];
export type CallbackAction = (typeof CallbackActions)[keyof typeof CallbackActions];
