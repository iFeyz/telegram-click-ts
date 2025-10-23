import { Bot, session } from 'grammy';
import type { BotContext, BotSessionData } from './types';
import { config } from '../../shared/config/env';
import { BOT_COMMANDS } from '../../shared/constants';
import { container } from '../../shared/container/DIContainer';
import { errorMiddleware } from './middleware/errorMiddleware';
import { loggingMiddleware } from './middleware/loggingMiddleware';
import { rateLimitMiddleware } from './middleware/rateLimitMiddleware';
import { authMiddleware } from './middleware/authMiddleware';
import {
  startCommand,
  clickCommand,
  leaderboardCommand,
  statsCommand,
  changeNameCommand,
  helpCommand,
} from './handlers';
import { handleNavigation } from './handlers/navigationHandler';

export class TelegramBot {
  private bot: Bot<BotContext>;
  private isRunning = false;

  constructor() {
    this.bot = new Bot<BotContext>(config.telegram.botToken);
    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware(): void {
    // Session middleware - stores data per user
    this.bot.use(
      session({
        initial: (): BotSessionData => ({
          gameState: 'idle',
          clickBuffer: [],
        }),
        getSessionKey: (ctx) => {
          // Store session per user across all chats
          return ctx.from?.id.toString();
        },
      }),
    );

    // Error handling middleware (must be early)
    this.bot.use(errorMiddleware);

    // Logging middleware
    this.bot.use(loggingMiddleware);

    // Auth middleware - loads/creates user
    this.bot.use(authMiddleware);

    // Rate limiting middleware
    this.bot.use(rateLimitMiddleware);
  }

  private setupHandlers(): void {
    // Register commands
    this.bot.command('start', startCommand);
    this.bot.command('click', clickCommand);
    this.bot.command('leaderboard', leaderboardCommand);
    this.bot.command('stats', statsCommand);
    this.bot.command('changename', changeNameCommand);
    this.bot.command('help', helpCommand);

    // Handle callback queries with the comprehensive navigation handler
    this.bot.on('callback_query', handleNavigation);

    // Handle text messages (for name changes and other input)
    this.bot.on('message:text', async (ctx) => {
      // Check if we're expecting a name change
      if (ctx.session.temporaryData?.expectingName) {
        const newName = ctx.message.text.trim();

        if (newName.length < 2 || newName.length > 30) {
          await ctx.reply('Name must be between 2 and 30 characters. Please try again.');
          return;
        }

        // Update user's custom name
        const user = ctx.session.user;
        if (user) {
          user.customName = newName;

          // Persist to database
          const prisma = container.getPrisma();
          await prisma.user.update({
            where: { id: user.id },
            data: { customName: newName },
          });

          // Update leaderboard display name in Redis
          const leaderboardRepo = container.getLeaderboardRepository();
          await leaderboardRepo.setUserData(user.id, user.getDisplayName());

          await ctx.reply(
            `✅ Name changed successfully to: <b>${newName}</b>\n\nYour new display name is now active!`,
            { parse_mode: 'HTML' },
          );
        }

        // Clear the expectation
        ctx.session.temporaryData = {};
      } else {
        await ctx.reply("I didn't understand that. Use /help to see available commands.");
      }
    });
  }

  /**
   * Set bot commands in Telegram
   */
  public async setBotCommands(): Promise<void> {
    await this.bot.api.setMyCommands(BOT_COMMANDS);
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Bot is already running');
      return;
    }

    try {
      await this.setBotCommands();
      await this.bot.start({
        onStart: () => {
          console.log('Telegram bot started successfully');
          this.isRunning = true;
        },
      });
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    await this.bot.stop();
    this.isRunning = false;
    console.log('Telegram bot stopped');
  }

  /**
   * Get bot instance (for testing)
   */
  public getBotInstance(): Bot<BotContext> {
    return this.bot;
  }
}
