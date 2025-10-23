export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

export interface ILeaderboardRepository {
  updateScore(userId: string, score: number): Promise<void>;
  incrementScore(userId: string, increment: number): Promise<number>;
  getUserRank(userId: string): Promise<number | null>;
  getUserScore(userId: string): Promise<number>;
  getTop(limit: number): Promise<Array<{ userId: string; score: number; rank: number }>>;
  getUserNeighbors(
    userId: string,
    above: number,
    below: number,
  ): Promise<Array<{ userId: string; score: number; rank: number }>>;
  setUserData(userId: string, username: string): Promise<void>;
  getUserData(userId: string): Promise<string | null>;
  getFullLeaderboard(limit: number): Promise<LeaderboardEntry[]>;
  removeUser(userId: string): Promise<void>;
  getTotalUsers(): Promise<number>;
  clear(): Promise<void>;
}
