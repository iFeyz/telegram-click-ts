import type { CommandHandler } from '../types';
import { container } from '../../../shared/container/DIContainer';
import { EMOJIS } from '../../../shared/constants';
import { LeaderboardEntry } from '../../../domain/value-objects/LeaderboardEntry';

export const leaderboardCommand: CommandHandler = async (ctx) => {
  const user = ctx.session.user;
  const chatId = ctx.chat?.id.toString();

  if (!user || !chatId) {
    if (chatId) {
      const queuedMessageService = container.getQueuedMessageService();
      await queuedMessageService.sendMessage(chatId, 'Please use /start to begin the game.');
    }
    return;
  }

  const queuedMessageService = container.getQueuedMessageService();
  const leaderboardRepo = container.getLeaderboardRepository();

  const topPlayers = await leaderboardRepo.getFullLeaderboard(10);

  const userRank = await leaderboardRepo.getUserRank(user.id);
  const userScore = await leaderboardRepo.getUserScore(user.id);

  let leaderboardText = `${EMOJIS.TROPHY} <b>TOP 10 LEADERBOARD</b> ${EMOJIS.TROPHY}\n\n`;

  if (topPlayers.length === 0) {
    leaderboardText += 'No players yet. Be the first!\n';
  } else {
    for (const player of topPlayers) {
      const entry = new LeaderboardEntry(player);
      leaderboardText += `${entry.format()}\n`;
    }
  }

  if (userRank && userRank > 10) {
    leaderboardText += `\n....\n\n`;
    const userEntry = new LeaderboardEntry({
      userId: user.id,
      username: user.getDisplayName(),
      score: Number(userScore),
      rank: userRank,
    });
    leaderboardText += `<b>Your Position:</b>\n${userEntry.format()}\n`;
  }

  const totalPlayers = await leaderboardRepo.getTotalUsers();
  leaderboardText += `\n${EMOJIS.INFO} Total players: <b>${totalPlayers}</b>`;

  await queuedMessageService.sendLeaderboardUpdate(chatId, leaderboardText, {
    parse_mode: 'HTML',
  });
};
