export interface SessionData {
  userId: string;
  telegramId: string;
  username?: string;
  lastActivity: Date;
  clickCount: number;
}

export interface ISessionRepository {
  setSession(token: string, data: SessionData): Promise<void>;
  getSession(token: string): Promise<SessionData | null>;
  touchSession(token: string): Promise<boolean>;
  deleteSession(token: string): Promise<void>;
  sessionExists(token: string): Promise<boolean>;
  getUserSessions(userId: string): Promise<string[]>;
  clearUserSessions(userId: string): Promise<void>;
  incrementClickCount(token: string, increment: number): Promise<number>;
  getActiveSessionsCount(): Promise<number>;
  cleanupExpiredSessions(): Promise<number>;
}
