import { randomBytes } from 'crypto';
import { InvalidClickError } from '../../shared/errors';

export class Session {
  public readonly id: string;
  public readonly userId: string;
  public readonly telegramId: bigint;
  public readonly token: string;
  public username?: string;
  public isActive: boolean;
  public clickCount: number;
  public lastActivity: Date;
  public readonly createdAt: Date;
  public readonly expiresAt: Date;

  constructor(params: {
    id?: string;
    userId: string;
    telegramId: bigint;
    token?: string;
    username?: string;
    isActive?: boolean;
    clickCount?: number;
    lastActivity?: Date;
    createdAt?: Date;
    expiresAt?: Date;
    ttlMs?: number;
  }) {
    this.id = params.id ?? this.generateId();
    this.userId = params.userId;
    this.telegramId = params.telegramId;
    this.token = params.token ?? this.generateToken();
    this.username = params.username;
    this.isActive = params.isActive ?? true;
    this.clickCount = params.clickCount ?? 0;
    this.lastActivity = params.lastActivity ?? new Date();
    this.createdAt = params.createdAt ?? new Date();
    this.expiresAt = params.expiresAt ?? this.calculateExpiry(params.ttlMs ?? 3600000);
  }

  private generateId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private calculateExpiry(ttlMs: number): Date {
    return new Date(Date.now() + ttlMs);
  }

  /**
   * Check if session has expired
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Check if session needs refresh
   */
  needsRefresh(): boolean {
    const fiveMinutes = 5 * 60 * 1000;
    return new Date(Date.now() + fiveMinutes) > this.expiresAt;
  }

  /**
   * Update session activity
   */
  touch(): void {
    this.lastActivity = new Date();
  }

  /**
   * Increment click count
   */
  addClicks(count: number): void {
    if (count < 0) throw new InvalidClickError('Click count cannot be negative');
    this.clickCount += count;
    this.touch();
  }

  /**
   * Deactivate session
   */
  deactivate(): void {
    this.isActive = false;
  }

  /**
   * Extend session expiry
   */
  extend(ttlMs: number): void {
    this.expiresAt.setTime(Date.now() + ttlMs);
    this.touch();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      userId: this.userId,
      telegramId: this.telegramId.toString(),
      token: this.token,
      username: this.username,
      isActive: this.isActive,
      clickCount: this.clickCount,
      lastActivity: this.lastActivity.toISOString(),
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
    };
  }
}
