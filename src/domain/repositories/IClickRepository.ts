export interface IClickRepository {
  incrementClickCount(userId: string, count: number): Promise<number>;
  getPendingClicks(userId: string): Promise<number>;
  getAllPendingClicks(): Promise<Map<string, number>>;
  clearPendingClicks(userIds: string[]): Promise<void>;
  addClickEvent(userId: string, count: number): Promise<string>;
  readClickEvents(
    lastId?: string,
    count?: number,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      count: number;
      timestamp: number;
    }>
  >;
}
