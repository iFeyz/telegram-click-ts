import type { ObservabilityConfig } from '../../shared/config/observability';

export const createMockObservabilityConfig = (
  overrides?: Partial<ObservabilityConfig>,
): ObservabilityConfig => ({
  enabled: true,
  loki: {
    url: 'http://localhost:3100',
    enabled: false,
  },
  prometheus: {
    port: 9464,
    enabled: true,
  },
  logging: {
    level: 'info',
    pretty: false,
  },
  ...overrides,
});

export const createDisabledObservabilityConfig = (): ObservabilityConfig => ({
  enabled: false,
  loki: {
    url: 'http://localhost:3100',
    enabled: false,
  },
  prometheus: {
    port: 9464,
    enabled: false,
  },
  logging: {
    level: 'silent',
    pretty: false,
  },
});

export const createDevelopmentObservabilityConfig = (): ObservabilityConfig => ({
  enabled: true,
  loki: {
    url: 'http://localhost:3100',
    enabled: false,
  },
  prometheus: {
    port: 9464,
    enabled: true,
  },
  logging: {
    level: 'debug',
    pretty: true,
  },
});

export const createProductionObservabilityConfig = (): ObservabilityConfig => ({
  enabled: true,
  loki: {
    url: 'http://loki-prod:3100',
    enabled: true,
  },
  prometheus: {
    port: 9464,
    enabled: true,
  },
  logging: {
    level: 'info',
    pretty: false,
  },
});
