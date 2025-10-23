import { InlineKeyboard } from 'grammy';
import { EMOJIS } from '../../../shared/constants';

export const NavigationKeyboards = {
  /**
   * Main menu keyboard
   */
  mainMenu: () =>
    new InlineKeyboard()
      .text(`${EMOJIS.CLICK} Start Clicking`, 'menu:click')
      .text(`${EMOJIS.TROPHY} Leaderboard`, 'menu:leaderboard')
      .row()
      .text(`${EMOJIS.STAR} My Stats`, 'menu:stats')
      .text(`${EMOJIS.INFO} Help`, 'menu:help')
      .row()
      .text(`✏️ Change Name`, 'menu:changename')
      .text(`⚙️ Settings`, 'menu:settings'),

  /**
   * Click page keyboard
   */
  clickPage: (canClick: boolean) => {
    const keyboard = new InlineKeyboard();

    if (canClick) {
      keyboard.text(`${EMOJIS.CLICK} Click! ${EMOJIS.CLICK}`, 'action:click').row().row();
    } else {
      keyboard.text('⏳ Rate Limited - Please Wait', 'action:wait').row();
    }

    return keyboard
      .text(`${EMOJIS.TROPHY} Leaderboard`, 'menu:leaderboard')
      .text(`${EMOJIS.STAR} My Stats`, 'menu:stats')
      .row()
      .text('🏠 Main Menu', 'menu:main');
  },

  /**
   * Leaderboard page keyboard
   */
  leaderboardPage: (currentPage: number = 1, hasMore: boolean = false) => {
    const keyboard = new InlineKeyboard();

    if (currentPage > 1 || hasMore) {
      keyboard.row();
      if (currentPage > 1) {
        keyboard.text('⬅️ Previous', `page:leaderboard:${currentPage - 1}`);
      }
      keyboard.text(`📄 Page ${currentPage}`, 'action:current');
      if (hasMore) {
        keyboard.text('➡️ Next', `page:leaderboard:${currentPage + 1}`);
      }
      keyboard.row();
    }

    return keyboard
      .text('📊 My Position', 'action:myposition')
      .row()
      .text(`${EMOJIS.CLICK} Click`, 'menu:click')
      .text(`${EMOJIS.STAR} My Stats`, 'menu:stats')
      .row()
      .text('🏠 Main Menu', 'menu:main');
  },

  /**
   * Stats page keyboard
   */
  statsPage: () =>
    new InlineKeyboard()
      .row()
      .text('📈 Detailed Stats', 'menu:detailed_stats')
      .text('🏆 Achievements', 'menu:achievements')
      .row()
      .text(`${EMOJIS.CLICK} Click`, 'menu:click')
      .text(`${EMOJIS.TROPHY} Leaderboard`, 'menu:leaderboard')
      .row()
      .text('🏠 Main Menu', 'menu:main'),

  /**
   * Help page keyboard
   */
  helpPage: () =>
    new InlineKeyboard()
      .text('🎮 How to Play', 'help:howto')
      .text('📜 Rules', 'help:rules')
      .row()
      .text('⚡ Commands', 'help:commands')
      .text('❓ FAQ', 'help:faq')
      .row()
      .text(`${EMOJIS.CLICK} Start Playing`, 'menu:click')
      .row()
      .text('🏠 Main Menu', 'menu:main'),

  /**
   * Settings page keyboard
   */
  settingsPage: (notifications: boolean = true) =>
    new InlineKeyboard()
      .text(
        `${notifications ? '🔔' : '🔕'} Notifications: ${notifications ? 'ON' : 'OFF'}`,
        'settings:notifications',
      )
      .row()
      .text('🌍 Language', 'settings:language')
      .text('🎨 Theme', 'settings:theme')
      .row()
      .text('👤 Profile', 'settings:profile')
      .text('🗑️ Clear Data', 'settings:clear')
      .row()
      .text('🏠 Main Menu', 'menu:main'),

  /**
   * Confirmation keyboard
   */
  confirmation: (action: string) =>
    new InlineKeyboard()
      .text('✅ Yes', `confirm:${action}`)
      .text('❌ No', 'action:cancel')
      .row()
      .text('🏠 Main Menu', 'menu:main'),

  /**
   * Back button only
   */
  backButton: (destination: string = 'main') =>
    new InlineKeyboard().text('⬅️ Back', `menu:${destination}`),

  /**
   * Error keyboard
   */
  errorKeyboard: () =>
    new InlineKeyboard().text('🔄 Try Again', 'action:retry').text('🏠 Main Menu', 'menu:main'),
};
