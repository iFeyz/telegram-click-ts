export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface ClickEvent {
  userId: string;
  count: number;
  timestamp: Date;
  sessionId?: string;
}

export interface LeaderboardUpdate {
  userId: string;
  username: string;
  score: number;
  rank: number;
  change: 'up' | 'down' | 'same' | 'new';
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

export enum GameState {
  IDLE = 'idle',
  CLICKING = 'clicking',
  COOLDOWN = 'cooldown',
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
