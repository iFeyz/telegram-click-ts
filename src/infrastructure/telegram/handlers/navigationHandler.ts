import type { BotContext } from '../types';
import { NavigationKeyboards } from '../keyboards/navigationKeyboard';
import { EMOJIS } from '../../../shared/constants';
import { container } from '../../../shared/container/DIContainer';
import { logger } from '../../observability/logger';
import { BotEvents } from '../../observability/events';

/**
 * Handle all navigation callbacks from inline keyboards
 */
export async function handleNavigation(ctx: BotContext): Promise<void> {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery || !callbackQuery.data) return;

  const data = callbackQuery.data;
  const [type, action, ...params] = data.split(':');

  await ctx.answerCallbackQuery();

  try {
    switch (type) {
      case 'menu':
        if (action) await handleMenuNavigation(ctx, action);
        break;
      case 'action':
        if (action) await handleAction(ctx, action, params);
        break;
      case 'page':
        if (action) await handlePagination(ctx, action, params);
        break;
      case 'help':
        if (action) await handleHelpSection(ctx, action);
        break;
      case 'settings':
        if (action) await handleSettings(ctx, action);
        break;
      case 'confirm':
        if (action) await handleConfirmation(ctx, action);
        break;
      default:
        // Fallback for old callback data format
        await handleLegacyCallback(ctx, data);
    }
  } catch (error) {
    logger.error({
      event: BotEvents.BOT_ERROR,
      message: 'Navigation error',
      error: error instanceof Error ? error.message : String(error),
    });
    // Keep using editMessageText for errors since it's editing an existing message
    // This doesn't count against rate limit in the same way as new messages
    await ctx.editMessageText(`${EMOJIS.ERROR} An error occurred. Please try again.`, {
      reply_markup: NavigationKeyboards.errorKeyboard(),
    });
  }
}

/**
 * Handle menu navigation
 */
async function handleMenuNavigation(ctx: BotContext, destination: string): Promise<void> {
  switch (destination) {
    case 'main':
      await showMainMenu(ctx);
      break;
    case 'click':
      await showClickPage(ctx);
      break;
    case 'leaderboard':
      await showLeaderboardPage(ctx);
      break;
    case 'stats':
      await showStatsPage(ctx);
      break;
    case 'help':
      await showHelpPage(ctx);
      break;
    case 'changename':
      await showChangeNamePage(ctx);
      break;
    case 'settings':
      await showSettingsPage(ctx);
      break;
    case 'detailed_stats':
      await showDetailedStats(ctx);
      break;
    case 'achievements':
      await showAchievements(ctx);
      break;
  }
}

/**
 * Handle actions
 */
async function handleAction(ctx: BotContext, action: string, _params: string[]): Promise<void> {
  switch (action) {
    case 'click':
      await handleClickAction(ctx);
      break;
    case 'myposition':
      await showUserPosition(ctx);
      break;
    case 'cancel':
      await showMainMenu(ctx);
      break;
    case 'retry':
      await showMainMenu(ctx);
      break;
    case 'wait':
      await ctx.answerCallbackQuery({
        text: 'Please wait for rate limit to reset...',
        show_alert: true,
      });
      break;
  }
}

/**
 * Show main menu
 */
async function showMainMenu(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  if (!user) {
    await ctx.editMessageText('Please use /start to begin');
    return;
  }

  const menuText = `
${EMOJIS.ROCKET} <b>Telegram Clicker Bot</b> ${EMOJIS.ROCKET}

Welcome back, ${user.getDisplayName()}!
Your Score: <b>${user.score}</b> points

What would you like to do?
  `.trim();

  await ctx.editMessageText(menuText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.mainMenu(),
  });
}

/**
 * Show click page
 */
async function showClickPage(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  if (!user) return;

  const rateLimiter = container.getRateLimiterRepository();
  const rateStatus = await rateLimiter.getRateLimitStatus(user.id, 10, 1);

  const clickPageText = `
${EMOJIS.CLICK} <b>CLICK ZONE</b> ${EMOJIS.CLICK}

Your Score: <b>${user.score}</b> points
Rate Limit: ${rateStatus.remaining}/10 clicks available

Each click = +1 point

${rateStatus.allowed ? '✅ Ready to click!' : '⏳ Rate limited - wait a moment'}
  `.trim();

  await ctx.editMessageText(clickPageText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.clickPage(rateStatus.allowed),
  });
}

/**
 * Handle click action
 */
async function handleClickAction(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  const session = ctx.session.session;
  const chatId = ctx.chat?.id.toString();

  if (!user || !session || !chatId) return;

  const rateLimiter = container.getRateLimiterRepository();
  const rateLimit = await rateLimiter.checkClickRateLimit(user.id);

  if (!rateLimit.allowed) {
    // Rate limited - just show the page with updated status
    await showClickPage(ctx);
    return;
  }

  // IMMEDIATELY process the click (not queued)
  const clickCount = 1;

  const clickRepo = container.getClickRepository();
  const newPendingTotal = await clickRepo.incrementClickCount(user.id, clickCount);

  user.addClicks(clickCount);
  session.addClicks(clickCount);

  const sessionRepo = container.getSessionRepository();
  await sessionRepo.incrementClickCount(session.token, clickCount);

  const leaderboardRepo = container.getLeaderboardRepository();
  await leaderboardRepo.incrementScore(user.id, clickCount);

  await clickRepo.addClickEvent(user.id, clickCount);

  const resultText = `
${EMOJIS.CLICK} <b>Click Registered!</b>

${EMOJIS.SPARKLES} +${clickCount} point
${EMOJIS.TROPHY} Total Score: <b>${user.score}</b>
${EMOJIS.SPARKLES} Pending: ${newPendingTotal}

Rate Limit: ${rateLimit.remaining}/10 remaining
  `.trim();

  // Edit the message IMMEDIATELY, not queued
  try {
    await ctx.editMessageText(resultText, {
      parse_mode: 'HTML',
      reply_markup: NavigationKeyboards.clickPage(rateLimit.remaining > 0),
    });
  } catch (error) {
    // If edit fails, log it but don't crash
    logger.error({
      message: 'Failed to update UI after click',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Show leaderboard page
 */
async function showLeaderboardPage(ctx: BotContext, page: number = 1): Promise<void> {
  const user = ctx.session.user;
  if (!user) return;

  const leaderboardRepo = container.getLeaderboardRepository();
  const limit = 10;
  const offset = (page - 1) * limit;

  const topPlayers = await leaderboardRepo.getFullLeaderboard(limit);
  const totalPlayers = await leaderboardRepo.getTotalUsers();
  const userRank = await leaderboardRepo.getUserRank(user.id);

  let leaderboardText = `${EMOJIS.TROPHY} <b>LEADERBOARD - Page ${page}</b> ${EMOJIS.TROPHY}\n\n`;

  if (topPlayers.length === 0) {
    leaderboardText += 'No players yet. Be the first!\n';
  } else {
    topPlayers.forEach((player, index) => {
      const position = offset + index + 1;
      const medal =
        position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
      leaderboardText += `${medal} ${player.username} - <b>${player.score}</b>\n`;
    });
  }

  if (userRank && userRank > 10) {
    leaderboardText += `\n...\n\n📍 Your Position: #${userRank}`;
  }

  leaderboardText += `\n\n👥 Total Players: ${totalPlayers}`;

  const hasMore = totalPlayers > page * limit;

  await ctx.editMessageText(leaderboardText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.leaderboardPage(page, hasMore),
  });
}

/**
 * Show stats page
 */
async function showStatsPage(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  const session = ctx.session.session;
  if (!user || !session) return;

  const leaderboardRepo = container.getLeaderboardRepository();
  const clickRepo = container.getClickRepository();

  const userRank = await leaderboardRepo.getUserRank(user.id);
  const pendingClicks = await clickRepo.getPendingClicks(user.id);

  const statsText = `
${EMOJIS.STAR} <b>YOUR STATISTICS</b> ${EMOJIS.STAR}

👤 Player: ${user.getDisplayName()}
${EMOJIS.TROPHY} Score: <b>${user.score}</b>
🏅 Rank: <b>#${userRank || 'Unranked'}</b>

📊 Session Stats:
• Clicks: ${session.clickCount}
• Pending: ${pendingClicks}
• Started: ${session.createdAt.toLocaleTimeString()}

Keep clicking to climb! ${EMOJIS.FIRE}
  `.trim();

  await ctx.editMessageText(statsText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.statsPage(),
  });
}

/**
 * Show help page
 */
async function showHelpPage(ctx: BotContext): Promise<void> {
  const helpText = `
${EMOJIS.INFO} <b>HELP CENTER</b> ${EMOJIS.INFO}

Welcome to Telegram Clicker Bot!

This is a fun clicking game where you:
• Click to earn points
• Compete on the leaderboard
• Track your progress

Use the buttons below to learn more!
  `.trim();

  await ctx.editMessageText(helpText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.helpPage(),
  });
}

/**
 * Show settings page
 */
async function showSettingsPage(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  if (!user) return;

  const settingsText = `
⚙️ <b>SETTINGS</b> ⚙️

Configure your bot experience:

👤 User: ${user.getDisplayName()}
🆔 ID: <code>${user.telegramId}</code>
📅 Joined: ${user.createdAt.toLocaleDateString()}
  `.trim();

  await ctx.editMessageText(settingsText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.settingsPage(true),
  });
}

/**
 * Show change name page
 */
async function showChangeNamePage(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  if (!user) return;

  const changeNameText = `
✏️ <b>CHANGE DISPLAY NAME</b> ✏️

Current name: <b>${user.getDisplayName()}</b>

To change your name:
1. Click the button below
2. Send your new name
3. Confirm the change

Note: This won't change your Telegram username
  `.trim();

  await ctx.editMessageText(changeNameText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.backButton('main'),
  });

  ctx.session.temporaryData = { expectingName: true };
}

/**
 * Show user position
 */
async function showUserPosition(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  if (!user) return;

  const leaderboardRepo = container.getLeaderboardRepository();
  const userRank = await leaderboardRepo.getUserRank(user.id);
  const neighbors = await leaderboardRepo.getUserNeighbors(user.id, 2, 2);

  let positionText = `📍 <b>YOUR POSITION</b> 📍\n\n`;

  if (userRank) {
    neighbors.forEach((player) => {
      const isUser = player.userId === user.id;
      const prefix = isUser ? '👉 ' : '   ';
      positionText += `${prefix}#${player.rank} ${isUser ? `<b>${user.getDisplayName()}</b>` : 'Player'} - ${player.score}\n`;
    });
  } else {
    positionText += 'You are not ranked yet. Start clicking!';
  }

  await ctx.editMessageText(positionText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.backButton('leaderboard'),
  });
}

/**
 * Handle pagination
 */
async function handlePagination(ctx: BotContext, section: string, params: string[]): Promise<void> {
  const page = parseInt(params[0] || '1', 10);

  if (section === 'leaderboard') {
    await showLeaderboardPage(ctx, page);
  }
}

/**
 * Handle help sections
 */
async function handleHelpSection(ctx: BotContext, section: string): Promise<void> {
  let helpText = '';

  switch (section) {
    case 'howto':
      helpText = `
🎮 <b>HOW TO PLAY</b>

1. Click the "Start Clicking" button
2. Choose your click power
3. Earn points with each click
4. Check the leaderboard
5. Beat other players!

It's that simple! ${EMOJIS.PARTY}
      `;
      break;
    case 'rules':
      helpText = `
📜 <b>GAME RULES</b>

• Max 10 clicks per second
• Points range: 1-100 per click
• Fair play only - no bots!
• Respect rate limits
• Have fun!
      `;
      break;
    case 'commands':
      helpText = `
⚡ <b>COMMANDS</b>

While you can navigate with buttons, these commands also work:

/start - Start the bot
/click - Click to earn
/leaderboard - View rankings
/stats - Your statistics
/help - This help menu
      `;
      break;
    case 'faq':
      helpText = `
❓ <b>FAQ</b>

Q: Why am I rate limited?
A: To ensure fair play and respect Telegram limits

Q: How are points calculated?
A: Random 1-10 points per click, with multipliers

Q: Can I change my name?
A: Yes! Use the Change Name option in settings
      `;
      break;
  }

  await ctx.editMessageText(helpText.trim(), {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.backButton('help'),
  });
}

/**
 * Handle settings
 */
async function handleSettings(ctx: BotContext, setting: string): Promise<void> {
  switch (setting) {
    case 'notifications':
      await ctx.answerCallbackQuery({
        text: 'Notification settings coming soon!',
        show_alert: true,
      });
      break;
    case 'language':
      await ctx.answerCallbackQuery({
        text: 'Language selection coming soon!',
        show_alert: true,
      });
      break;
    case 'theme':
      await ctx.answerCallbackQuery({
        text: 'Theme selection coming soon!',
        show_alert: true,
      });
      break;
    case 'profile':
      await showStatsPage(ctx);
      break;
    case 'clear':
      await ctx.editMessageText(
        '⚠️ <b>Clear Data</b>\n\nAre you sure you want to reset your progress?',
        {
          parse_mode: 'HTML',
          reply_markup: NavigationKeyboards.confirmation('cleardata'),
        },
      );
      break;
  }
}

/**
 * Handle confirmations
 */
async function handleConfirmation(ctx: BotContext, action: string): Promise<void> {
  if (action === 'cleardata') {
    await ctx.answerCallbackQuery({
      text: 'Data clearing not implemented yet',
      show_alert: true,
    });
  }
  await showMainMenu(ctx);
}

/**
 * Show detailed stats
 */
async function showDetailedStats(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  if (!user) return;

  const detailedText = `
📈 <b>DETAILED STATISTICS</b> 📈

Coming soon:
• Daily/Weekly/Monthly stats
• Click patterns
• Best scores
• Achievement progress
• Performance graphs

Stay tuned! ${EMOJIS.STAR}
  `.trim();

  await ctx.editMessageText(detailedText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.backButton('stats'),
  });
}

/**
 * Show achievements
 */
async function showAchievements(ctx: BotContext): Promise<void> {
  const user = ctx.session.user;
  if (!user) return;

  const score = Number(user.score);

  const achievementsText = `
🏆 <b>ACHIEVEMENTS</b> 🏆

${score >= 100 ? '✅' : '⬜'} First Century - 100 points
${score >= 1000 ? '✅' : '⬜'} Thousand Club - 1,000 points
${score >= 10000 ? '✅' : '⬜'} Ten K Master - 10,000 points
${score >= 100000 ? '✅' : '⬜'} Hundred K Legend - 100,000 points
${score >= 1000000 ? '✅' : '⬜'} Millionaire - 1,000,000 points

Your Progress: ${score >= 1000000 ? '🏆 LEGEND!' : score >= 100000 ? '🥇 Master' : score >= 10000 ? '🥈 Expert' : score >= 1000 ? '🥉 Advanced' : score >= 100 ? '⭐ Beginner' : '🌱 Newcomer'}
  `.trim();

  await ctx.editMessageText(achievementsText, {
    parse_mode: 'HTML',
    reply_markup: NavigationKeyboards.backButton('stats'),
  });
}

/**
 * Handle legacy callbacks
 */
async function handleLegacyCallback(ctx: BotContext, data: string): Promise<void> {
  switch (data) {
    case 'click':
      // For legacy click callback, process the click immediately
      await handleClickAction(ctx);
      break;
    case 'leaderboard':
      await showLeaderboardPage(ctx);
      break;
    case 'stats':
      await showStatsPage(ctx);
      break;
    default:
      await showMainMenu(ctx);
  }
}
