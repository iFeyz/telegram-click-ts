import { config } from './env';

export interface ObservabilityConfig {
  enabled: boolean;
  loki: {
    url: string;
    enabled: boolean;
  };
  prometheus: {
    port: number;
    enabled: boolean;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
}

export const observabilityConfig: ObservabilityConfig = {
  enabled: config.ENABLE_OBSERVABILITY ?? true,
  loki: {
    url: config.LOKI_URL ?? 'http://localhost:3100',
    enabled: config.ENABLE_LOKI ?? true,
  },
  prometheus: {
    port: config.PROMETHEUS_PORT ?? 9464,
    enabled: config.ENABLE_METRICS ?? true,
  },
  logging: {
    level: config.LOG_LEVEL ?? 'info',
    pretty: config.NODE_ENV === 'development',
  },
};
