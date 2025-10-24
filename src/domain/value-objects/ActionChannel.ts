export class ActionChannel {
  public readonly domain: string;
  public readonly context: string;
  public readonly isReplaceable: boolean;

  private constructor(domain: string, context: string, isReplaceable: boolean) {
    this.domain = domain;
    this.context = context;
    this.isReplaceable = isReplaceable;
  }

  static replaceable(domain: string, context: string): ActionChannel {
    this.validate(domain, context);
    return new ActionChannel(domain, context, true);
  }

  static nonReplaceable(domain: string, context: string): ActionChannel {
    this.validate(domain, context);
    return new ActionChannel(domain, context, false);
  }

  private static validate(domain: string, context: string): void {
    if (!domain || domain.trim().length === 0) {
      throw new Error('Channel domain cannot be empty');
    }
    if (!context || context.trim().length === 0) {
      throw new Error('Channel context cannot be empty');
    }
    if (!/^[A-Z][a-zA-Z]*$/.test(domain)) {
      throw new Error('Channel domain must be PascalCase');
    }
    if (!/^[a-z][a-zA-Z]*$/.test(context)) {
      throw new Error('Channel context must be camelCase');
    }
  }

  get fullName(): string {
    return `${this.domain}.${this.context}`;
  }

  getTrackingKey(userId: string): string {
    return `channel:${this.domain}:${this.context}:user:${userId}`;
  }

  equals(other: ActionChannel): boolean {
    return this.domain === other.domain && this.context === other.context;
  }

  static deserialize(data: {
    domain: string;
    context: string;
    isReplaceable: boolean;
  }): ActionChannel {
    return new ActionChannel(data.domain, data.context, data.isReplaceable);
  }
}

export const ActionChannels = {
  UserInterface: {
    navigation: ActionChannel.replaceable('UserInterface', 'navigation'),
    modal: ActionChannel.replaceable('UserInterface', 'modal'),
    form: ActionChannel.replaceable('UserInterface', 'form'),
  },

  Game: {
    action: ActionChannel.nonReplaceable('Game', 'action'),
    session: ActionChannel.replaceable('Game', 'session'),
    results: ActionChannel.replaceable('Game', 'results'),
  },

  Social: {
    leaderboard: ActionChannel.replaceable('Social', 'leaderboard'),
    profile: ActionChannel.replaceable('Social', 'profile'),
    stats: ActionChannel.replaceable('Social', 'stats'),
  },

  System: {
    notification: ActionChannel.nonReplaceable('System', 'notification'),
    error: ActionChannel.nonReplaceable('System', 'error'),
    status: ActionChannel.replaceable('System', 'status'),
  },
} as const;
