import type { Context, SessionFlavor } from 'grammy';
import type { Session } from '../../domain/entities/Session';
import type { User } from '../../domain/entities/User';

/**
 * Custom session data stored in bot context
 */
export interface BotSessionData {
  user?: User;
  session?: Session;
  gameState: 'idle' | 'clicking' | 'cooldown';
  lastClickTime?: number;
  clickBuffer: number[];
  temporaryData?: Record<string, unknown>;
}

export type BotContext = Context & SessionFlavor<BotSessionData>;
export type CommandHandler = (ctx: BotContext) => Promise<void>;
export type BotMiddleware = (ctx: BotContext, next: () => Promise<void>) => Promise<void>;
