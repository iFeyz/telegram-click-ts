import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { observabilityConfig } from './shared/config/observability';

let sdk: NodeSDK | null = null;

if (observabilityConfig.enabled && observabilityConfig.prometheus.enabled) {
  const prometheusExporter = new PrometheusExporter({
    port: observabilityConfig.prometheus.port + 1,
  });

  sdk = new NodeSDK({
    metricReader: prometheusExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-ioredis': {
          enabled: true,
        },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk?.shutdown().catch((error: Error) => {
      console.error('Error shutting down OpenTelemetry SDK', error);
    });
  });
}
