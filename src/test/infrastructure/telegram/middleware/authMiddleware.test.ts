import { authMiddleware } from '../../../../infrastructure/telegram/middleware/authMiddleware';
import { container } from '../../../../shared/container/DIContainer';
import { User } from '../../../../domain/entities/User';
import { Session } from '../../../../domain/entities/Session';
import type { BotContext } from '../../../../infrastructure/telegram/types';

jest.mock('../../../../shared/container/DIContainer');

const createMockContext = (overrides: Partial<BotContext> = {}): BotContext => {
  return {
    from: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      is_bot: false,
    },
    session: {
      user: undefined,
      session: undefined,
    },
    ...overrides,
  } as BotContext;
};

describe('authMiddleware', () => {
  let mockPrisma: any;
  let mockSessionRepo: any;
  let mockLeaderboardRepo: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    mockSessionRepo = {
      setSession: jest.fn(),
      touchSession: jest.fn(),
    };

    mockLeaderboardRepo = {
      setUserData: jest.fn(),
    };

    mockNext = jest.fn();

    (container.getPrisma as jest.Mock).mockReturnValue(mockPrisma);
    (container.getSessionRepository as jest.Mock).mockReturnValue(mockSessionRepo);
    (container.getLeaderboardRepository as jest.Mock).mockReturnValue(mockLeaderboardRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bot detection', () => {
    it('should skip auth for bot users', async () => {
      const ctx = createMockContext({
        from: { id: 123456, first_name: 'Bot', is_bot: true } as any,
      });

      await authMiddleware(ctx, mockNext);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip auth when from is undefined', async () => {
      const ctx = createMockContext({ from: undefined });

      await authMiddleware(ctx, mockNext);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('user creation and loading', () => {
    it('should create new user if not exists', async () => {
      const ctx = createMockContext();
      const newUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(newUser);

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await authMiddleware(ctx, mockNext);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt(123456789) },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: BigInt(123456789),
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          score: BigInt(0),
        },
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('New user registered'));
      expect(ctx.session.user).toBeInstanceOf(User);

      consoleLogSpy.mockRestore();
    });

    it('should load existing user from database', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: 'Cool Name',
        score: BigInt(1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await authMiddleware(ctx, mockNext);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(ctx.session.user).toBeInstanceOf(User);
      expect(ctx.session.user?.score).toBe(BigInt(1000));
      expect(ctx.session.user?.customName).toBe('Cool Name');
    });

    it('should skip user loading if already in session', async () => {
      const existingUser = new User({
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        score: BigInt(500),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createMockContext();
      ctx.session.user = existingUser;

      await authMiddleware(ctx, mockNext);

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle user without username', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456789,
          first_name: 'Test',
          last_name: 'User',
          username: undefined,
          is_bot: false,
        } as any,
      });

      const newUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: null,
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(newUser);

      await authMiddleware(ctx, mockNext);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: undefined,
        }),
      });
      expect(ctx.session.user?.username).toBeUndefined();
    });

    it('should handle user without lastName', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456789,
          first_name: 'Test',
          username: 'testuser',
          is_bot: false,
        } as any,
      });

      const newUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: null,
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(newUser);

      await authMiddleware(ctx, mockNext);

      expect(ctx.session.user?.lastName).toBeUndefined();
    });
  });

  describe('session management', () => {
    it('should create new session if none exists', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await authMiddleware(ctx, mockNext);

      expect(mockSessionRepo.setSession).toHaveBeenCalled();
      expect(ctx.session.session).toBeInstanceOf(Session);
      expect(ctx.session.session?.userId).toBe('user-1');
    });

    it('should create new session if current session is expired', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      ctx.session.user = new User({
        ...existingUser,
        customName: undefined,
      });

      const expiredSession = new Session({
        userId: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
      });

      jest.spyOn(expiredSession, 'isExpired').mockReturnValue(true);
      ctx.session.session = expiredSession;

      await authMiddleware(ctx, mockNext);

      expect(mockSessionRepo.setSession).toHaveBeenCalled();
      expect(ctx.session.session).not.toBe(expiredSession);
    });

    it('should touch existing valid session', async () => {
      const ctx = createMockContext();
      const existingUser = new User({
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: undefined,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const activeSession = new Session({
        userId: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
      });

      ctx.session.user = existingUser;
      ctx.session.session = activeSession;

      const touchSpy = jest.spyOn(activeSession, 'touch');

      await authMiddleware(ctx, mockNext);

      expect(touchSpy).toHaveBeenCalled();
      expect(mockSessionRepo.touchSession).toHaveBeenCalledWith(activeSession.token);
      expect(mockSessionRepo.setSession).not.toHaveBeenCalled();
    });

    it('should store session data in Redis', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await authMiddleware(ctx, mockNext);

      expect(mockSessionRepo.setSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-1',
          telegramId: '123456789',
          username: 'testuser',
          clickCount: 0,
        }),
      );
    });
  });

  describe('leaderboard integration', () => {
    it('should update leaderboard with user display name', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: 'Custom Display Name',
        score: BigInt(500),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await authMiddleware(ctx, mockNext);

      expect(mockLeaderboardRepo.setUserData).toHaveBeenCalledWith('user-1', 'Custom Display Name');
    });

    it('should use firstName as fallback for leaderboard when no username', async () => {
      const ctx = createMockContext({
        from: {
          id: 123456789,
          first_name: 'Test',
          username: undefined,
          is_bot: false,
        } as any,
      });

      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: null,
        firstName: 'Test',
        lastName: null,
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await authMiddleware(ctx, mockNext);

      expect(mockLeaderboardRepo.setUserData).toHaveBeenCalledWith('user-1', 'Test');
    });
  });

  describe('next middleware', () => {
    it('should call next middleware', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await authMiddleware(ctx, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const ctx = createMockContext();
      const dbError = new Error('Database connection failed');

      mockPrisma.user.findUnique.mockRejectedValueOnce(dbError);

      await expect(authMiddleware(ctx, mockNext)).rejects.toThrow('Database connection failed');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should propagate session repository errors', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);
      mockSessionRepo.setSession.mockRejectedValueOnce(new Error('Redis error'));

      await expect(authMiddleware(ctx, mockNext)).rejects.toThrow('Redis error');
    });

    it('should propagate leaderboard repository errors', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);
      mockLeaderboardRepo.setUserData.mockRejectedValueOnce(new Error('Leaderboard error'));

      await expect(authMiddleware(ctx, mockNext)).rejects.toThrow('Leaderboard error');
    });
  });

  describe('edge cases', () => {
    it('should handle very large telegram IDs', async () => {
      const largeTelegramId = 9999999999;
      const ctx = createMockContext({
        from: {
          id: largeTelegramId,
          first_name: 'Test',
          is_bot: false,
        } as any,
      });

      const newUser = {
        id: 'user-1',
        telegramId: BigInt(largeTelegramId),
        username: null,
        firstName: 'Test',
        lastName: null,
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(newUser);

      await authMiddleware(ctx, mockNext);

      expect(ctx.session.user?.telegramId).toBe(BigInt(largeTelegramId));
    });

    it('should handle concurrent requests for same user', async () => {
      const ctx1 = createMockContext();
      const ctx2 = createMockContext();

      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await Promise.all([authMiddleware(ctx1, mockNext), authMiddleware(ctx2, mockNext)]);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should handle empty session object', async () => {
      const ctx = createMockContext();
      const existingUser = {
        id: 'user-1',
        telegramId: BigInt(123456789),
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        customName: null,
        score: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValueOnce(existingUser);

      await authMiddleware(ctx, mockNext);

      expect(ctx.session.user).toBeDefined();
      expect(ctx.session.session).toBeDefined();
    });
  });
});
