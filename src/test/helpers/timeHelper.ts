export class TimeHelper {
  private originalDateNow: () => number;
  private mockTime: number | null = null;

  constructor() {
    this.originalDateNow = Date.now;
  }

  freeze(timestamp?: number): void {
    this.mockTime = timestamp ?? Date.now();
    Date.now = jest.fn(() => this.mockTime!);
  }

  unfreeze(): void {
    Date.now = this.originalDateNow;
    this.mockTime = null;
  }

  advance(ms: number): void {
    if (this.mockTime === null) {
      throw new Error('Time is not frozen. Call freeze() first.');
    }
    this.mockTime += ms;
  }

  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }

  advanceHours(hours: number): void {
    this.advance(hours * 60 * 60 * 1000);
  }

  getCurrentTime(): number {
    return this.mockTime ?? Date.now();
  }

  reset(): void {
    this.unfreeze();
  }
}

export function createTimeHelper(): TimeHelper {
  return new TimeHelper();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitUntil(
  condition: () => boolean,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Condition not met within ${timeoutMs}ms`));
      }
    }, intervalMs);
  });
}
