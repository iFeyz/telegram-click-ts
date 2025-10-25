import type { BotMiddleware } from '../types';
import { container } from '../../../shared/container/DIContainer';
import { User } from '../../../domain/entities/User';
import { Session } from '../../../domain/entities/Session';
import { logger } from '../../observability/logger';
import { BotEvents } from '../../observability/events';

export const authMiddleware: BotMiddleware = async (ctx, next) => {
  if (!ctx.from || ctx.from.is_bot) {
    await next();
    return;
  }

  const telegramId = BigInt(ctx.from.id);

  if (!ctx.session.user) {
    const prisma = container.getPrisma();

    let dbUser = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          telegramId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          score: BigInt(0),
        },
      });

      logger.info({
        event: BotEvents.USER_JOINED,
        userId: dbUser.id,
        telegramId: String(dbUser.telegramId),
        username: dbUser.username,
      });
    }

    ctx.session.user = new User({
      id: dbUser.id,
      telegramId: dbUser.telegramId,
      username: dbUser.username ?? undefined,
      firstName: dbUser.firstName ?? undefined,
      lastName: dbUser.lastName ?? undefined,
      customName: dbUser.customName ?? undefined,
      score: dbUser.score,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    });
  }

  if (!ctx.session.session || ctx.session.session.isExpired()) {
    const newSession = new Session({
      userId: ctx.session.user.id,
      telegramId,
      username: ctx.from.username,
    });

    const sessionRepo = container.getSessionRepository();
    await sessionRepo.setSession(newSession.token, {
      userId: newSession.userId,
      telegramId: newSession.telegramId.toString(),
      username: newSession.username,
      lastActivity: newSession.lastActivity,
      clickCount: newSession.clickCount,
    });

    ctx.session.session = newSession;
  } else {
    ctx.session.session.touch();
    const sessionRepo = container.getSessionRepository();
    await sessionRepo.touchSession(ctx.session.session.token);
  }

  const leaderboardRepo = container.getLeaderboardRepository();
  await leaderboardRepo.setUserData(ctx.session.user.id, ctx.session.user.getDisplayName());

  await next();
};
