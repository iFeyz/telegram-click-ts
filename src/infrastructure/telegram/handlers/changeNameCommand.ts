import type { CommandHandler } from '../types';
import { EMOJIS } from '../../../shared/constants';
import { container } from '../../../shared/container/DIContainer';

export const changeNameCommand: CommandHandler = async (ctx) => {
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

  await queuedMessageService.sendPriorityMessage(
    chatId,
    `${EMOJIS.INFO} <b>Change Display Name</b>\n\nCurrent name: <b>${user.getDisplayName()}</b>\n\nPlease send your new display name:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        force_reply: true,
        input_field_placeholder: 'Enter new name...',
      },
    },
  );

  ctx.session.gameState = 'clicking';
  ctx.session.temporaryData = {
    expectingName: true,
  };
};
