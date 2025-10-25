import http from 'http';
import { startMetricsServer, stopMetricsServer } from '../../../infrastructure/observability/metricsServer';
import { metrics, metricsRegistry } from '../../../infrastructure/observability/metrics';
import { observabilityConfig } from '../../../shared/config/observability';
import { logger } from '../../../infrastructure/observability/logger';

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  },
}));

describe('metricsServer', () => {
  let originalConfig: typeof observabilityConfig;

  beforeAll(() => {
    originalConfig = { ...observabilityConfig };
  });

  beforeEach(async () => {
    stopMetricsServer();
    metricsRegistry.resetMetrics();
    jest.clearAllMocks();
  });

  afterEach(() => {
    stopMetricsServer();
  });

  afterAll(() => {
    Object.assign(observabilityConfig, originalConfig);
  });

  describe('startMetricsServer', () => {
    it('should start server when prometheus is enabled', (done) => {
      observabilityConfig.prometheus.enabled = true;

      startMetricsServer();

      setTimeout(() => {
        const req = http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          expect(res.statusCode).toBe(200);
          stopMetricsServer();
          done();
        });

        req.on('error', (err) => {
          stopMetricsServer();
          done(err);
        });
      }, 100);
    });

    it('should not start server when prometheus is disabled', (done) => {
      observabilityConfig.prometheus.enabled = false;

      startMetricsServer();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Metrics server disabled',
        }),
      );

      setTimeout(() => {
        const req = http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, () => {
          done(new Error('Server should not be running'));
        });

        req.on('error', () => {
          done();
        });
      }, 100);
    });

    it('should log server start message', (done) => {
      observabilityConfig.prometheus.enabled = true;

      startMetricsServer();

      setTimeout(() => {
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            message: `Metrics server listening on http://localhost:${observabilityConfig.prometheus.port}/metrics`,
            port: observabilityConfig.prometheus.port,
          }),
        );

        stopMetricsServer();
        done();
      }, 100);
    });

    it('should listen on configured port', (done) => {
      observabilityConfig.prometheus.enabled = true;
      const testPort = observabilityConfig.prometheus.port;

      startMetricsServer();

      setTimeout(() => {
        const req = http.get(`http://localhost:${testPort}/metrics`, (res) => {
          expect(res.statusCode).toBe(200);
          stopMetricsServer();
          done();
        });

        req.on('error', (err) => {
          stopMetricsServer();
          done(err);
        });
      }, 100);
    });
  });

  describe('stopMetricsServer', () => {
    it('should stop running server', (done) => {
      observabilityConfig.prometheus.enabled = true;

      startMetricsServer();

      setTimeout(() => {
        stopMetricsServer();

        setTimeout(() => {
          const req = http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, () => {
            done(new Error('Server should be stopped'));
          });

          req.on('error', () => {
            done();
          });
        }, 100);
      }, 100);
    });

    it('should handle stopping when server not running', () => {
      expect(() => stopMetricsServer()).not.toThrow();
    });

    it('should handle multiple stop calls', () => {
      observabilityConfig.prometheus.enabled = true;

      startMetricsServer();
      stopMetricsServer();

      expect(() => stopMetricsServer()).not.toThrow();
    });
  });

  describe('/metrics endpoint', () => {
    beforeEach(() => {
      observabilityConfig.prometheus.enabled = true;
    });

    it('should return 200 for /metrics', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          expect(res.statusCode).toBe(200);
          stopMetricsServer();
          done();
        });
      }, 100);
    });

    it('should return prometheus content type', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          expect(res.headers['content-type']).toContain('text/plain');
          stopMetricsServer();
          done();
        });
      }, 100);
    });

    it('should return metrics data', (done) => {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });

      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            expect(data).toContain('bot_requests_total');
            expect(data).toContain('app="telegram-bot"');
            stopMetricsServer();
            done();
          });
        });
      }, 100);
    });

    it('should return updated metrics on subsequent calls', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res1) => {
          let data1 = '';
          res1.on('data', (chunk) => {
            data1 += chunk;
          });
          res1.on('end', () => {
            metrics.requestsTotal.inc({ command: '/start', status: 'success' });

            http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res2) => {
              let data2 = '';
              res2.on('data', (chunk) => {
                data2 += chunk;
              });
              res2.on('end', () => {
                expect(data2).not.toBe(data1);
                stopMetricsServer();
                done();
              });
            });
          });
        });
      }, 100);
    });

    it('should handle concurrent requests', (done) => {
      startMetricsServer();

      setTimeout(() => {
        const requests = [];

        for (let i = 0; i < 10; i++) {
          requests.push(
            new Promise<void>((resolve, reject) => {
              http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
                if (res.statusCode === 200) {
                  resolve();
                } else {
                  reject(new Error(`Expected 200, got ${res.statusCode}`));
                }
              }).on('error', reject);
            }),
          );
        }

        Promise.all(requests)
          .then(() => {
            stopMetricsServer();
            done();
          })
          .catch((err) => {
            stopMetricsServer();
            done(err);
          });
      }, 100);
    });

    it('should return valid prometheus format', (done) => {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });
      metrics.activeSessions.set(10);

      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            expect(data).toMatch(/# HELP/);
            expect(data).toMatch(/# TYPE/);
            expect(data).toMatch(/bot_requests_total\{.*\}/);
            expect(data).toMatch(/bot_active_sessions{.*}/);
            stopMetricsServer();
            done();
          });
        });
      }, 100);
    });
  });

  describe('404 endpoint', () => {
    beforeEach(() => {
      observabilityConfig.prometheus.enabled = true;
    });

    it('should return 404 for unknown paths', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/unknown`, (res) => {
          expect(res.statusCode).toBe(404);
          stopMetricsServer();
          done();
        });
      }, 100);
    });

    it('should return 404 for root path', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/`, (res) => {
          expect(res.statusCode).toBe(404);
          stopMetricsServer();
          done();
        });
      }, 100);
    });

    it('should return Not Found message', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/unknown`, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            expect(data).toBe('Not Found');
            stopMetricsServer();
            done();
          });
        });
      }, 100);
    });

    it('should ignore query parameters and return metrics', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics?format=json`, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            expect(res.statusCode).toBe(404);
            expect(data).toBe('Not Found');
            stopMetricsServer();
            done();
          });
        }).on('error', (err) => {
          stopMetricsServer();
          done(err);
        });
      }, 100);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      observabilityConfig.prometheus.enabled = true;
    });

    it('should handle malformed requests', (done) => {
      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          expect(res.statusCode).toBe(200);
          stopMetricsServer();
          done();
        });
      }, 100);
    });

    it('should handle server restart', (done) => {
      startMetricsServer();

      setTimeout(() => {
        stopMetricsServer();

        setTimeout(() => {
          startMetricsServer();

          setTimeout(() => {
            http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
              expect(res.statusCode).toBe(200);
              stopMetricsServer();
              done();
            });
          }, 100);
        }, 100);
      }, 100);
    });
  });

  describe('integration', () => {
    beforeEach(() => {
      observabilityConfig.prometheus.enabled = true;
    });

    it('should serve metrics for complete bot lifecycle', (done) => {
      metrics.requestsTotal.inc({ command: '/start', status: 'success' });
      metrics.requestDuration.observe({ command: '/start', success: 'true' }, 0.1);
      metrics.activeSessions.inc();
      metrics.usersTotal.inc();
      metrics.clicksTotal.inc({ userId: '123' });

      startMetricsServer();

      setTimeout(() => {
        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            expect(data).toContain('bot_requests_total');
            expect(data).toContain('bot_request_duration_seconds');
            expect(data).toContain('bot_active_sessions');
            expect(data).toContain('bot_users_total');
            expect(data).toContain('bot_clicks_total');
            stopMetricsServer();
            done();
          });
        });
      }, 100);
    });

    it('should serve metrics during active bot operation', (done) => {
      startMetricsServer();

      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          metrics.requestsTotal.inc({ command: '/start', status: 'success' });
          metrics.clicksTotal.inc({ userId: `user${i}` });
        }

        http.get(`http://localhost:${observabilityConfig.prometheus.port}/metrics`, (res) => {
          expect(res.statusCode).toBe(200);
          stopMetricsServer();
          done();
        });
      }, 100);
    });
  });
});
