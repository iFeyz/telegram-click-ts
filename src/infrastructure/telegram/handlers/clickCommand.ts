import { InlineKeyboard } from 'grammy';
import type { CommandHandler } from '../types';
import { container } from '../../../shared/container/DIContainer';
import { EMOJIS, GAME_SETTINGS } from '../../../shared/constants';
import { Click } from '../../../domain/value-objects/Click';
import { RateLimitError } from '../../../shared/errors';

export const clickCommand: CommandHandler = async (ctx) => {
  const user = ctx.session.user;
  const session = ctx.session.session;
  const chatId = ctx.chat?.id.toString();

  if (!user || !session || !chatId) {
    if (chatId) {
      const queuedMessageService = container.getQueuedMessageService();
      await queuedMessageService.sendMessage(chatId, 'Please use /start to begin the game.');
    }
    return;
  }

  const queuedMessageService = container.getQueuedMessageService();

  const rateLimiter = container.getRateLimiterRepository();
  const rateLimit = await rateLimiter.checkClickRateLimit(user.id);

  if (!rateLimit.allowed) {
    const waitSeconds = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
    console.error(
      `[RATE LIMIT] User ${user.id} (${user.getDisplayName()}) exceeded click rate limit. Must wait ${waitSeconds}s`,
    );
    throw new RateLimitError(rateLimit.resetAt);
  }

  const clickCount = 1;

  try {
    new Click({
      userId: user.id,
      count: clickCount,
    });

    const clickRepo = container.getClickRepository();
    const newPendingTotal = await clickRepo.incrementClickCount(user.id, clickCount);

    user.addClicks(clickCount);

    session.addClicks(clickCount);
    const sessionRepo = container.getSessionRepository();
    await sessionRepo.incrementClickCount(session.token, clickCount);

    const leaderboardRepo = container.getLeaderboardRepository();
    await leaderboardRepo.incrementScore(user.id, clickCount);

    await clickRepo.addClickEvent(user.id, clickCount);

    const responseMessage = `
${EMOJIS.CLICK} <b>Click Registered!</b>

${EMOJIS.SPARKLES} +${clickCount} point
${EMOJIS.TROPHY} Total score: <b>${user.score}</b>
${EMOJIS.FIRE} Session total: <b>${session.clickCount}</b> clicks
${EMOJIS.SPARKLES} Pending save to DB: <b>${newPendingTotal}</b>

<b>⚠️ Rate Limit Status:</b>
Remaining: <b>${rateLimit.remaining}/${GAME_SETTINGS.MAX_CLICKS_PER_SECOND}</b> clicks
<i>Max 10 clicks/second to respect Telegram limits</i>
    `.trim();

    const keyboard = new InlineKeyboard()
      .text(`${EMOJIS.CLICK} Click Again!`, 'click')
      .row()
      .text(`${EMOJIS.TROPHY} Leaderboard`, 'leaderboard')
      .text(`${EMOJIS.STAR} My Stats`, 'stats');

    if (ctx.callbackQuery) {
      await ctx.editMessageText(responseMessage, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } else {
      await queuedMessageService.sendPriorityMessage(chatId, responseMessage, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    }

    if (user.score >= BigInt(100) && user.score - BigInt(clickCount) < BigInt(100)) {
      await queuedMessageService.sendNotification(
        chatId,
        `${EMOJIS.PARTY} Congratulations! You've reached 100 points! ${EMOJIS.PARTY}`,
      );
    }
    if (user.score >= BigInt(1000) && user.score - BigInt(clickCount) < BigInt(1000)) {
      await queuedMessageService.sendNotification(
        chatId,
        `${EMOJIS.TROPHY} Amazing! You've reached 1,000 points! Keep going! ${EMOJIS.TROPHY}`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      await queuedMessageService.sendError(chatId, error.message);
    } else {
      throw error;
    }
  }
};
