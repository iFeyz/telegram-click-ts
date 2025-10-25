import http from 'http';
import { metricsRegistry } from './metrics';
import { observabilityConfig } from '../../shared/config/observability';

let server: http.Server | null = null;

export function startMetricsServer(): void {
  if (!observabilityConfig.prometheus.enabled) {
    console.log('Metrics server disabled');
    return;
  }

  server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', metricsRegistry.contentType);
      const metrics = await metricsRegistry.metrics();
      res.end(metrics);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  const port = observabilityConfig.prometheus.port;
  server.listen(port, () => {
    console.log(`Metrics server listening on http://localhost:${port}/metrics`);
  });
}

export function stopMetricsServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
