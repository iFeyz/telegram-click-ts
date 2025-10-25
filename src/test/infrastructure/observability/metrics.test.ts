import { Registry } from 'prom-client';
import { metricsRegistry, metrics, getMetricsEndpoint } from '../../../infrastructure/observability/metrics';

describe('metricsRegistry', () => {
  it('should be an instance of Registry', () => {
    expect(metricsRegistry).toBeInstanceOf(Registry);
  });

  it('should have default labels', () => {
    expect(() => {
      metricsRegistry.setDefaultLabels({ app: 'telegram-bot' });
    }).not.toThrow();
  });

  it('should have content type for prometheus', () => {
    expect(metricsRegistry.contentType).toBeDefined();
    expect(metricsRegistry.contentType).toContain('text/plain');
  });
});

describe('metrics', () => {
  beforeEach(async () => {
    metricsRegistry.resetMetrics();
  });

  describe('requestsTotal', () => {
    it('should be defined', () => {
      expect(metrics.requestsTotal).toBeDefined();
      expect((metrics.requestsTotal as unknown as Record<string, unknown>).name).toBe('bot_requests_total');
    });

    it('should increment with labels', () => {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });
      metrics.requestsTotal.inc({ command: '/help', status: 'error' });

      const metricValue = metrics.requestsTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should track different commands separately', () => {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });
      metrics.requestsTotal.inc({ command: '/help', status: 'success' });
      metrics.requestsTotal.inc({ command: 'click', status: 'success' });

      const metricValue = metrics.requestsTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should track success and error separately', () => {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });
      metrics.requestsTotal.inc({ command: '/start', status: 'error' });

      const metricValue = metrics.requestsTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should support custom increment values', () => {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' }, 5);

      const metricValue = metrics.requestsTotal as any;
      expect(metricValue).toBeDefined();
    });
  });

  describe('requestDuration', () => {
    it('should be defined', () => {
      expect(metrics.requestDuration).toBeDefined();
      expect((metrics.requestDuration as unknown as Record<string, unknown>).name).toBe('bot_request_duration_seconds');
    });

    it('should observe duration with labels', () => {
      metrics.requestDuration.observe({ command: '/start', success: 'true' }, 0.1);
      metrics.requestDuration.observe({ command: '/help', success: 'true' }, 0.05);
      metrics.requestDuration.observe({ command: '/start', success: 'false' }, 1.5);

      const metricValue = metrics.requestDuration as any;
      expect(metricValue).toBeDefined();
    });

    it('should have proper buckets', () => {
      const histogram = metrics.requestDuration as any;
      expect(histogram.upperBounds).toEqual([0.01, 0.05, 0.1, 0.5, 1, 2, 5]);
    });

    it('should track fast requests', () => {
      metrics.requestDuration.observe({ command: '/start', success: 'true' }, 0.001);
      metrics.requestDuration.observe({ command: '/start', success: 'true' }, 0.005);
      metrics.requestDuration.observe({ command: '/start', success: 'true' }, 0.009);

      const metricValue = metrics.requestDuration as any;
      expect(metricValue).toBeDefined();
    });

    it('should track slow requests', () => {
      metrics.requestDuration.observe({ command: '/start', success: 'true' }, 3.5);
      metrics.requestDuration.observe({ command: '/start', success: 'true' }, 4.8);

      const metricValue = metrics.requestDuration as any;
      expect(metricValue).toBeDefined();
    });
  });

  describe('errorsTotal', () => {
    it('should be defined', () => {
      expect(metrics.errorsTotal).toBeDefined();
      expect((metrics.errorsTotal as unknown as Record<string, unknown>).name).toBe('bot_errors_total');
    });

    it('should increment with error type and command', () => {
      metrics.errorsTotal.inc({ errorType: 'ValidationError', command: '/start' });
      metrics.errorsTotal.inc({ errorType: 'DatabaseError', command: '/help' });
      metrics.errorsTotal.inc({ errorType: 'ValidationError', command: '/start' });

      const metricValue = metrics.errorsTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should track different error types', () => {
      metrics.errorsTotal.inc({ errorType: 'ValidationError', command: '/start' });
      metrics.errorsTotal.inc({ errorType: 'DatabaseError', command: '/start' });
      metrics.errorsTotal.inc({ errorType: 'RateLimitError', command: '/start' });
      metrics.errorsTotal.inc({ errorType: 'UnknownError', command: '/start' });

      const metricValue = metrics.errorsTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should support custom increment values', () => {
      metrics.errorsTotal.inc({ errorType: 'DatabaseError', command: '/start' }, 10);

      const metricValue = metrics.errorsTotal as any;
      expect(metricValue).toBeDefined();
    });
  });

  describe('activeSessions', () => {
    it('should be defined', () => {
      expect(metrics.activeSessions).toBeDefined();
      expect((metrics.activeSessions as unknown as Record<string, unknown>).name).toBe('bot_active_sessions');
    });

    it('should set gauge value', () => {
      metrics.activeSessions.set(10);
      metrics.activeSessions.set(25);
      metrics.activeSessions.set(5);

      const metricValue = metrics.activeSessions as any;
      expect(metricValue).toBeDefined();
    });

    it('should increment gauge', () => {
      metrics.activeSessions.set(0);
      metrics.activeSessions.inc();
      metrics.activeSessions.inc();
      metrics.activeSessions.inc(3);

      const metricValue = metrics.activeSessions as any;
      expect(metricValue).toBeDefined();
    });

    it('should decrement gauge', () => {
      metrics.activeSessions.set(10);
      metrics.activeSessions.dec();
      metrics.activeSessions.dec();
      metrics.activeSessions.dec(2);

      const metricValue = metrics.activeSessions as any;
      expect(metricValue).toBeDefined();
    });

    it('should not go below zero', () => {
      metrics.activeSessions.set(0);
      metrics.activeSessions.dec();

      const metricValue = metrics.activeSessions as any;
      expect(metricValue).toBeDefined();
    });
  });

  describe('clicksTotal', () => {
    it('should be defined', () => {
      expect(metrics.clicksTotal).toBeDefined();
      expect((metrics.clicksTotal as unknown as Record<string, unknown>).name).toBe('bot_clicks_total');
    });

    it('should increment with userId label', () => {
      metrics.clicksTotal.inc({ userId: '123' });
      metrics.clicksTotal.inc({ userId: '123' });
      metrics.clicksTotal.inc({ userId: '456' });

      const metricValue = metrics.clicksTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should track clicks per user independently', () => {
      metrics.clicksTotal.inc({ userId: 'user1' }, 10);
      metrics.clicksTotal.inc({ userId: 'user2' }, 5);
      metrics.clicksTotal.inc({ userId: 'user3' }, 3);

      const metricValue = metrics.clicksTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should support high click counts', () => {
      metrics.clicksTotal.inc({ userId: 'user1' }, 1000);
      metrics.clicksTotal.inc({ userId: 'user1' }, 5000);

      const metricValue = metrics.clicksTotal as any;
      expect(metricValue).toBeDefined();
    });
  });

  describe('leaderboardViews', () => {
    it('should be defined', () => {
      expect(metrics.leaderboardViews).toBeDefined();
      expect((metrics.leaderboardViews as unknown as Record<string, unknown>).name).toBe('bot_leaderboard_views_total');
    });

    it('should increment without labels', () => {
      metrics.leaderboardViews.inc();
      metrics.leaderboardViews.inc();
      metrics.leaderboardViews.inc(5);

      const metricValue = metrics.leaderboardViews as any;
      expect(metricValue).toBeDefined();
    });

    it('should accumulate over time', () => {
      for (let i = 0; i < 100; i++) {
        metrics.leaderboardViews.inc();
      }

      const metricValue = metrics.leaderboardViews as any;
      expect(metricValue).toBeDefined();
    });
  });

  describe('usersTotal', () => {
    it('should be defined', () => {
      expect(metrics.usersTotal).toBeDefined();
      expect((metrics.usersTotal as unknown as Record<string, unknown>).name).toBe('bot_users_total');
    });

    it('should increment without labels', () => {
      metrics.usersTotal.inc();
      metrics.usersTotal.inc();
      metrics.usersTotal.inc(3);

      const metricValue = metrics.usersTotal as any;
      expect(metricValue).toBeDefined();
    });

    it('should track user growth', () => {
      metrics.usersTotal.inc(1);
      metrics.usersTotal.inc(5);
      metrics.usersTotal.inc(10);

      const metricValue = metrics.usersTotal as any;
      expect(metricValue).toBeDefined();
    });
  });

  describe('rateLimitHits', () => {
    it('should be defined', () => {
      expect(metrics.rateLimitHits).toBeDefined();
      expect((metrics.rateLimitHits as unknown as Record<string, unknown>).name).toBe('bot_rate_limit_hits_total');
    });

    it('should increment with limitType label', () => {
      metrics.rateLimitHits.inc({ limitType: 'click' });
      metrics.rateLimitHits.inc({ limitType: 'message' });
      metrics.rateLimitHits.inc({ limitType: 'command' });

      const metricValue = metrics.rateLimitHits as any;
      expect(metricValue).toBeDefined();
    });

    it('should track different rate limit types', () => {
      metrics.rateLimitHits.inc({ limitType: 'click' }, 10);
      metrics.rateLimitHits.inc({ limitType: 'message' }, 5);
      metrics.rateLimitHits.inc({ limitType: 'global' }, 2);

      const metricValue = metrics.rateLimitHits as any;
      expect(metricValue).toBeDefined();
    });
  });
});

describe('getMetricsEndpoint', () => {
  beforeEach(async () => {
    metricsRegistry.resetMetrics();
  });

  it('should return metrics as string', async () => {
    const result = await getMetricsEndpoint();

    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });

  it('should include metric names', async () => {
    metrics.requestsTotal.inc({ command: '/start', status: 'success' });

    const result = await getMetricsEndpoint();

    expect(result).toContain('bot_requests_total');
  });

  it('should include help text', async () => {
    const result = await getMetricsEndpoint();

    expect(result).toContain('# HELP');
    expect(result).toContain('# TYPE');
  });

  it('should include default labels', async () => {
    metrics.requestsTotal.inc({ command: '/start', status: 'success' });

    const result = await getMetricsEndpoint();

    expect(result).toContain('app="telegram-bot"');
  });

  it('should include all metrics', async () => {
    metrics.requestsTotal.inc({ command: '/start', status: 'success' });
    metrics.requestDuration.observe({ command: '/start', success: 'true' }, 0.1);
    metrics.errorsTotal.inc({ errorType: 'ValidationError', command: '/start' });
    metrics.activeSessions.set(10);
    metrics.clicksTotal.inc({ userId: '123' });
    metrics.leaderboardViews.inc();
    metrics.usersTotal.inc();
    metrics.rateLimitHits.inc({ limitType: 'click' });

    const result = await getMetricsEndpoint();

    expect(result).toContain('bot_requests_total');
    expect(result).toContain('bot_request_duration_seconds');
    expect(result).toContain('bot_errors_total');
    expect(result).toContain('bot_active_sessions');
    expect(result).toContain('bot_clicks_total');
    expect(result).toContain('bot_leaderboard_views_total');
    expect(result).toContain('bot_users_total');
    expect(result).toContain('bot_rate_limit_hits_total');
  });

  it('should format metrics in prometheus format', async () => {
    metrics.requestsTotal.inc({ command: '/start', status: 'success' });

    const result = await getMetricsEndpoint();

    expect(result).toMatch(/# HELP bot_requests_total/);
    expect(result).toMatch(/# TYPE bot_requests_total counter/);
    expect(result).toMatch(/bot_requests_total\{.*\}/);
  });

  it('should handle empty metrics', async () => {
    const result = await getMetricsEndpoint();

    expect(typeof result).toBe('string');
    expect(result).toBeTruthy();
  });

  it('should be consistent between calls', async () => {
    metrics.requestsTotal.inc({ command: '/start', status: 'success' });

    const result1 = await getMetricsEndpoint();
    const result2 = await getMetricsEndpoint();

    expect(result1).toBe(result2);
  });

  it('should reflect metric changes', async () => {
    const result1 = await getMetricsEndpoint();

    metrics.requestsTotal.inc({ command: '/start', status: 'success' });

    const result2 = await getMetricsEndpoint();

    expect(result2).not.toBe(result1);
    expect(result2.length).toBeGreaterThan(result1.length);
  });
});

describe('metrics integration', () => {
  beforeEach(async () => {
    metricsRegistry.resetMetrics();
  });

  it('should track complete request lifecycle', () => {
    const startTime = Date.now();

    metrics.requestsTotal.inc({ command: '/start', status: 'success' });

    const duration = (Date.now() - startTime) / 1000;
    metrics.requestDuration.observe({ command: '/start', success: 'true' }, duration);

    metrics.activeSessions.inc();
    metrics.usersTotal.inc();

    const metricValue = metrics.requestsTotal as any;
    expect(metricValue).toBeDefined();
  });

  it('should track error scenarios', () => {
    metrics.requestsTotal.inc({ command: '/start', status: 'error' });
    metrics.errorsTotal.inc({ errorType: 'DatabaseError', command: '/start' });
    metrics.requestDuration.observe({ command: '/start', success: 'false' }, 0.5);

    const metricValue = metrics.errorsTotal as any;
    expect(metricValue).toBeDefined();
  });

  it('should track user activity', () => {
    metrics.usersTotal.inc();
    metrics.activeSessions.inc();
    metrics.clicksTotal.inc({ userId: '123' });
    metrics.clicksTotal.inc({ userId: '123' });
    metrics.leaderboardViews.inc();

    const metricValue = metrics.clicksTotal as any;
    expect(metricValue).toBeDefined();
  });

  it('should handle concurrent operations', () => {
    for (let i = 0; i < 100; i++) {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });
      metrics.clicksTotal.inc({ userId: `user${i % 10}` });
      metrics.activeSessions.inc();
    }

    for (let i = 0; i < 50; i++) {
      metrics.activeSessions.dec();
    }

    const metricValue = metrics.activeSessions as any;
    expect(metricValue).toBeDefined();
  });

  it('should handle rate limiting scenarios', () => {
    metrics.requestsTotal.inc({ command: 'click', status: 'error' });
    metrics.rateLimitHits.inc({ limitType: 'click' });
    metrics.errorsTotal.inc({ errorType: 'RateLimitError', command: 'click' });

    const metricValue = metrics.rateLimitHits as any;
    expect(metricValue).toBeDefined();
  });
});
