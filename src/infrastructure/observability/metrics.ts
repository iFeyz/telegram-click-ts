import { Counter, Histogram, Gauge, Registry } from 'prom-client';
//import { observabilityConfig } from '../../shared/config/observability';

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({
  app: 'telegram-bot',
});

export const metrics = {
  requestsTotal: new Counter({
    name: 'bot_requests_total',
    help: 'Total number of bot requests',
    labelNames: ['command', 'status'] as const,
    registers: [metricsRegistry],
  }),

  requestDuration: new Histogram({
    name: 'bot_request_duration_seconds',
    help: 'Bot request duration in seconds',
    labelNames: ['command', 'success'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [metricsRegistry],
  }),

  errorsTotal: new Counter({
    name: 'bot_errors_total',
    help: 'Total number of bot errors',
    labelNames: ['errorType', 'command'] as const,
    registers: [metricsRegistry],
  }),

  activeSessions: new Gauge({
    name: 'bot_active_sessions',
    help: 'Number of active sessions',
    registers: [metricsRegistry],
  }),

  clicksTotal: new Counter({
    name: 'bot_clicks_total',
    help: 'Total number of clicks',
    labelNames: ['userId'] as const,
    registers: [metricsRegistry],
  }),

  leaderboardViews: new Counter({
    name: 'bot_leaderboard_views_total',
    help: 'Total number of leaderboard views',
    registers: [metricsRegistry],
  }),

  usersTotal: new Counter({
    name: 'bot_users_total',
    help: 'Total number of unique users',
    registers: [metricsRegistry],
  }),

  rateLimitHits: new Counter({
    name: 'bot_rate_limit_hits_total',
    help: 'Total number of rate limit violations',
    labelNames: ['limitType'] as const,
    registers: [metricsRegistry],
  }),
};

export async function getMetricsEndpoint(): Promise<string> {
  return await metricsRegistry.metrics();
}
