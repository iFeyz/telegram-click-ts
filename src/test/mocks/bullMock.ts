import type { Queue, Job, JobOptions } from 'bull';

interface MockJob<T = unknown> {
  id: string | number;
  data: T;
  opts: JobOptions;
  timestamp: number;
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
}

export class BullQueueMock<T = unknown> {
  private jobs: Map<string | number, MockJob<T>> = new Map();
  private jobIdCounter = 1;
  private processor?: (job: Job<T>) => Promise<unknown>;

  async add(data: T, opts?: JobOptions): Promise<Job<T>> {
    const id = opts?.jobId ?? this.jobIdCounter++;
    const job: MockJob<T> = {
      id,
      data,
      opts: opts ?? {},
      timestamp: Date.now(),
      attemptsMade: 0,
    };
    this.jobs.set(id, job);

    if (this.processor) {
      setTimeout(() => this.processJob(id), opts?.delay ?? 0);
    }

    return this.createJobObject(job);
  }

  process(concurrency: number, processor: (job: Job<T>) => Promise<unknown>): void;
  process(processor: (job: Job<T>) => Promise<unknown>): void;
  process(
    concurrencyOrProcessor: number | ((job: Job<T>) => Promise<unknown>),
    processor?: (job: Job<T>) => Promise<unknown>,
  ): void {
    if (typeof concurrencyOrProcessor === 'function') {
      this.processor = concurrencyOrProcessor;
    } else {
      this.processor = processor;
    }
  }

  async getJob(id: string | number): Promise<Job<T> | null> {
    const job = this.jobs.get(id);
    return job ? this.createJobObject(job) : null;
  }

  async getJobs(_types: string[]): Promise<Job<T>[]> {
    return Array.from(this.jobs.values()).map((job) => this.createJobObject(job));
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const jobs = Array.from(this.jobs.values());
    return {
      waiting: jobs.filter((j) => !j.processedOn).length,
      active: jobs.filter((j) => j.processedOn && !j.finishedOn).length,
      completed: jobs.filter((j) => j.finishedOn && !j.failedReason).length,
      failed: jobs.filter((j) => j.failedReason).length,
      delayed: jobs.filter((j) => j.opts.delay).length,
    };
  }

  async empty(): Promise<void> {
    this.jobs.clear();
  }

  async clean(grace: number, _status?: string): Promise<Job<T>[]> {
    const cleaned: Job<T>[] = [];
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (job.finishedOn && now - job.finishedOn > grace) {
        cleaned.push(this.createJobObject(job));
        this.jobs.delete(id);
      }
    }
    return cleaned;
  }

  async close(): Promise<void> {
    this.jobs.clear();
    this.processor = undefined;
  }

  on(_event: string, _callback: (...args: unknown[]) => void): this {
    return this;
  }

  private async processJob(id: string | number): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || !this.processor) return;

    job.processedOn = Date.now();
    job.attemptsMade++;

    try {
      await this.processor(this.createJobObject(job));
      job.finishedOn = Date.now();
    } catch (error) {
      job.failedReason = error instanceof Error ? error.message : String(error);
      job.finishedOn = Date.now();
    }
  }

  private createJobObject(mockJob: MockJob<T>): Job<T> {
    return {
      id: mockJob.id,
      data: mockJob.data,
      opts: mockJob.opts,
      timestamp: mockJob.timestamp,
      attemptsMade: mockJob.attemptsMade,
      processedOn: mockJob.processedOn,
      finishedOn: mockJob.finishedOn,
      failedReason: mockJob.failedReason,
      remove: jest.fn(),
      retry: jest.fn(),
      discard: jest.fn(),
      promote: jest.fn(),
      update: jest.fn(),
    } as unknown as Job<T>;
  }

  reset(): void {
    this.jobs.clear();
    this.jobIdCounter = 1;
  }
}

export function createBullQueueMock<T = unknown>(): Queue<T> {
  return new BullQueueMock<T>() as unknown as Queue<T>;
}
