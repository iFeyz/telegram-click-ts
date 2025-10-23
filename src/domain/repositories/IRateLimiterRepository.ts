export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface IRateLimiterRepository {
  checkClickRateLimit(userId: string): Promise<RateLimitResult>;
  checkTelegramRateLimit(chatId: string, limitPerSecond?: number): Promise<RateLimitResult>;
  checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;
  resetRateLimit(identifier: string): Promise<void>;
  getRateLimitStatus(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult>;
}
