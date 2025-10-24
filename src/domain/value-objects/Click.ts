import { ValidationError, InvalidClickError } from '../../shared/errors';

export class Click {
  public readonly userId: string;
  public readonly count: number;
  public readonly timestamp: Date;

  constructor(params: { userId: string; count: number; timestamp?: Date }) {
    this.validateCount(params.count);

    this.userId = params.userId;
    this.count = params.count;
    this.timestamp = params.timestamp ?? new Date();
  }

  private validateCount(count: number): void {
    if (!Number.isInteger(count)) {
      throw new ValidationError({ count: 'Must be an integer' });
    }
    if (count <= 0) {
      throw new InvalidClickError('Click count must be positive');
    }
    if (count > 100) {
      throw new InvalidClickError('Click count cannot exceed 100 per batch');
    }
  }

  /**
   * Check if click is recent (within last 5 seconds)
   */
  isRecent(windowMs = 5000): boolean {
    return Date.now() - this.timestamp.getTime() < windowMs;
  }

  /**
   * Create a batch of clicks
   */
  static createBatch(userId: string, clicks: number[]): Click[] {
    return clicks.map((count) => new Click({ userId, count }));
  }

  /**
   * Aggregate multiple clicks
   */
  static aggregate(clicks: Click[]): Map<string, number> {
    const aggregated = new Map<string, number>();

    for (const click of clicks) {
      const current = aggregated.get(click.userId) ?? 0;
      aggregated.set(click.userId, current + click.count);
    }

    return aggregated;
  }

  toJSON(): Record<string, unknown> {
    return {
      userId: this.userId,
      count: this.count,
      timestamp: this.timestamp.toISOString(),
    };
  }
}
