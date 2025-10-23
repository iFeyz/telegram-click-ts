import type { CommandHandler } from '../types';
import { container } from '../../../shared/container/DIContainer';
import { EMOJIS } from '../../../shared/constants';

export const statsCommand: CommandHandler = async (ctx) => {
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
  const leaderboardRepo = container.getLeaderboardRepository();
  const clickRepo = container.getClickRepository();
  const sessionRepo = container.getSessionRepository();

  const userRank = await leaderboardRepo.getUserRank(user.id);
  const pendingClicks = await clickRepo.getPendingClicks(user.id);
  const activeSessions = await sessionRepo.getUserSessions(user.id);

  const timePlaying = Date.now() - user.createdAt.getTime();
  const daysPlaying = Math.floor(timePlaying / (1000 * 60 * 60 * 24));
  const hoursPlaying = Math.floor(timePlaying / (1000 * 60 * 60)) % 24;

  const statsMessage = `
${EMOJIS.STAR} <b>YOUR STATISTICS</b> ${EMOJIS.STAR}

<b>Player:</b> ${user.getDisplayName()}
<b>ID:</b> <code>${user.telegramId}</code>

${EMOJIS.TROPHY} <b>Score & Ranking</b>
Total Score: <b>${user.score}</b> points
Global Rank: <b>#${userRank || 'Unranked'}</b>
Pending Clicks: <b>${pendingClicks}</b>

${EMOJIS.CLICK} <b>Session Stats</b>
Current Session: <b>${session.clickCount}</b> clicks
Active Sessions: <b>${activeSessions.length}</b>
Session Started: <b>${session.createdAt.toLocaleTimeString()}</b>

${EMOJIS.INFO} <b>Account Info</b>
Playing for: <b>${daysPlaying}d ${hoursPlaying}h</b>
Joined: <b>${user.createdAt.toLocaleDateString()}</b>
Last Updated: <b>${user.updatedAt.toLocaleTimeString()}</b>

${EMOJIS.FIRE} Keep clicking to climb the ranks!
  `.trim();

  await queuedMessageService.sendMessage(chatId, statsMessage, {
    parse_mode: 'HTML',
  });
};
