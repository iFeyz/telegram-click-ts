import { EMOJIS } from '../../shared/constants';

export class LeaderboardEntry {
  public readonly userId: string;
  public readonly username: string;
  public readonly score: number;
  public readonly rank: number;
  public readonly change?: 'up' | 'down' | 'same' | 'new';
  public readonly previousRank?: number;

  constructor(params: {
    userId: string;
    username: string;
    score: number;
    rank: number;
    previousRank?: number;
  }) {
    this.userId = params.userId;
    this.username = params.username;
    this.score = params.score;
    this.rank = params.rank;
    this.previousRank = params.previousRank;
    this.change = this.calculateChange();
  }

  private calculateChange(): 'up' | 'down' | 'same' | 'new' | undefined {
    if (this.previousRank === undefined) return 'new';
    if (this.previousRank === this.rank) return 'same';
    if (this.previousRank > this.rank) return 'up';
    return 'down';
  }

  /**
   * Get medal emoji for top 3 positions
   */
  getMedalEmoji(): string {
    switch (this.rank) {
      case 1:
        return EMOJIS.MEDAL_GOLD;
      case 2:
        return EMOJIS.MEDAL_SILVER;
      case 3:
        return EMOJIS.MEDAL_BRONZE;
      default:
        return '';
    }
  }

  /**
   * Get change indicator emoji
   */
  getChangeEmoji(): string {
    switch (this.change) {
      case 'up':
        return EMOJIS.UP_ARROW;
      case 'down':
        return EMOJIS.DOWN_ARROW;
      case 'new':
        return EMOJIS.NEW;
      default:
        return '';
    }
  }

  /**
   * Format for display in Telegram
   */
  format(): string {
    const medal = this.getMedalEmoji();
    const change = this.getChangeEmoji();
    const rankDisplay = medal || `${this.rank}.`;
    const scoreDisplay = this.formatScore();
    const changeDisplay = change ? ` ${change}` : '';

    return `${rankDisplay} ${this.username} - ${scoreDisplay}${changeDisplay}`;
  }

  /**
   * Format score with K/M suffixes
   */
  private formatScore(): string {
    if (this.score >= 1_000_000) {
      return `${(this.score / 1_000_000).toFixed(1)}M`;
    }
    if (this.score >= 1_000) {
      return `${(this.score / 1_000).toFixed(1)}K`;
    }
    return this.score.toString();
  }

  /**
   * Check if entry is in top N
   */
  isInTop(n: number): boolean {
    return this.rank <= n;
  }

  toJSON(): Record<string, unknown> {
    return {
      userId: this.userId,
      username: this.username,
      score: this.score,
      rank: this.rank,
      change: this.change,
      previousRank: this.previousRank,
    };
  }
}
