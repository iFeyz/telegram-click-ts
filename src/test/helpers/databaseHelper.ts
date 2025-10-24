import type { PrismaClient } from '@prisma/client';

export class DatabaseTestHelper {
  constructor(private prisma: PrismaClient) {}

  async clearAllTables(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.click.deleteMany(),
      this.prisma.session.deleteMany(),
      this.prisma.leaderboardSnapshot.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);
  }

  async clearTable(table: 'user' | 'session' | 'click' | 'leaderboardSnapshot'): Promise<void> {
    await this.prisma[table].deleteMany();
  }

  async seedUsers(count: number): Promise<void> {
    const users = Array.from({ length: count }, (_, i) => ({
      id: `test-user-${i + 1}`,
      telegramId: BigInt(1000000 + i),
      username: `user${i + 1}`,
      firstName: `Test`,
      lastName: `User${i + 1}`,
      score: BigInt(Math.floor(Math.random() * 10000)),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await this.prisma.user.createMany({ data: users });
  }

  async getUserCount(): Promise<number> {
    return this.prisma.user.count();
  }

  async getClickCount(): Promise<number> {
    return this.prisma.click.count();
  }

  async getTotalScore(): Promise<bigint> {
    const result = await this.prisma.user.aggregate({
      _sum: { score: true },
    });
    return result._sum.score ?? BigInt(0);
  }

  async assertUserExists(telegramId: bigint): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    expect(user).not.toBeNull();
  }

  async assertUserScore(telegramId: bigint, expectedScore: bigint): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { telegramId } });
    expect(user).not.toBeNull();
    expect(user!.score).toBe(expectedScore);
  }

  async assertClicksExist(userId: string, minCount: number): Promise<void> {
    const count = await this.prisma.click.count({ where: { userId } });
    expect(count).toBeGreaterThanOrEqual(minCount);
  }
}

export function createDatabaseHelper(prisma: PrismaClient): DatabaseTestHelper {
  return new DatabaseTestHelper(prisma);
}
