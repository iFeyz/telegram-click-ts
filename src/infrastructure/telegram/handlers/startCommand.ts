import { InlineKeyboard } from 'grammy';
import type { CommandHandler } from '../types';
import { EMOJIS } from '../../../shared/constants';
import { container } from '../../../shared/container/DIContainer';

export const startCommand: CommandHandler = async (ctx) => {
  const user = ctx.session.user;
  if (!user) {
    await ctx.reply('Error: User not found. Please try again.');
    return;
  }

  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;

  const queuedMessageService = container.getQueuedMessageService();

  const welcomeMessage = `
${EMOJIS.ROCKET} <b>Welcome to Telegram Clicker Bot!</b> ${EMOJIS.ROCKET}

Hello, ${user.getDisplayName()}!

${EMOJIS.CLICK} Click to earn points and climb the leaderboard!
${EMOJIS.TROPHY} Compete with other players
${EMOJIS.FIRE} Show your clicking skills!

Your current score: <b>${user.score}</b> points

<b>Available Commands:</b>
/click - ${EMOJIS.CLICK} Start clicking
/leaderboard - ${EMOJIS.TROPHY} View top players
/stats - ${EMOJIS.STAR} Your statistics
/changename - ${EMOJIS.INFO} Change display name
/help - ${EMOJIS.INFO} Show help

Let's start clicking! ${EMOJIS.PARTY}
  `.trim();

  const keyboard = new InlineKeyboard()
    .text(`${EMOJIS.CLICK} Start Clicking`, 'click')
    .row()
    .text(`${EMOJIS.TROPHY} Leaderboard`, 'leaderboard')
    .text(`${EMOJIS.STAR} My Stats`, 'stats');

  await queuedMessageService.sendPriorityMessage(chatId, welcomeMessage, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
};
