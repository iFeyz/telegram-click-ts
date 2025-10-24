import { InvalidClickError } from '../../shared/errors';

export class User {
  public readonly id: string;
  public readonly telegramId: bigint;
  public username?: string;
  public firstName?: string;
  public lastName?: string;
  public customName?: string;
  public score: bigint;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(params: {
    id: string;
    telegramId: bigint;
    username?: string;
    firstName?: string;
    lastName?: string;
    customName?: string;
    score?: bigint;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = params.id;
    this.telegramId = params.telegramId;
    this.username = params.username;
    this.firstName = params.firstName;
    this.lastName = params.lastName;
    this.customName = params.customName;
    this.score = params.score ?? BigInt(0);
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
  }

  getDisplayName(): string {
    if (this.customName) return this.customName;
    if (this.username) return `@${this.username}`;
    if (this.firstName) {
      return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
    }
    return `User${this.telegramId}`;
  }

  addClicks(count: number): void {
    if (count < 0) {
      throw new InvalidClickError('Click count cannot be negative');
    }
    this.score = this.score + BigInt(count);
    this.updatedAt = new Date();
  }

  /**
   * Update user profile
   */
  updateProfile(params: {
    username?: string;
    firstName?: string;
    lastName?: string;
    customName?: string;
  }): void {
    if (params.username !== undefined) this.username = params.username;
    if (params.firstName !== undefined) this.firstName = params.firstName;
    if (params.lastName !== undefined) this.lastName = params.lastName;
    if (params.customName !== undefined) this.customName = params.customName;
    this.updatedAt = new Date();
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      telegramId: this.telegramId.toString(),
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      customName: this.customName,
      score: this.score.toString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
