import type { CommandHandler } from '../types';
import { EMOJIS, BOT_COMMANDS } from '../../../shared/constants';
import { container } from '../../../shared/container/DIContainer';

export const helpCommand: CommandHandler = async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const queuedMessageService = container.getQueuedMessageService();
  const helpMessage = `
${EMOJIS.INFO} <b>TELEGRAM CLICKER BOT HELP</b> ${EMOJIS.INFO}

<b>How to Play:</b>
1. Use /click to earn points
2. Compete with other players on the leaderboard
3. Check your stats and climb the ranks!

<b>Available Commands:</b>
${BOT_COMMANDS.map((cmd) => `${cmd.command} - ${cmd.description}`).join('\n')}

<b>Game Features:</b>
${EMOJIS.CLICK} <b>Clicking System</b>
- Each click gives you random points (1-10)
- Rate limited to prevent spam
- Points are saved automatically

${EMOJIS.TROPHY} <b>Leaderboard</b>
- Real-time global rankings
- See top 10 players
- Track your position

${EMOJIS.STAR} <b>Statistics</b>
- Total score and rank
- Session statistics
- Playing time

${EMOJIS.FIRE} <b>Tips:</b>
- Click consistently to build your score
- Check the leaderboard to see your competition
- Use inline buttons for quick actions

<b>Rate Limits:</b>
- Max 10 clicks per second
- Telegram message limits apply

Enjoy the game! ${EMOJIS.PARTY}
  `.trim();

  await queuedMessageService.sendMessage(chatId, helpMessage, {
    parse_mode: 'HTML',
  });
};
