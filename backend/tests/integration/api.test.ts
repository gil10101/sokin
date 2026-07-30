/**
 * API Integration Tests
 *
 * Boots the REAL Express app (src/index.ts, which api/index.ts re-exports)
 * and drives it with supertest. The previous version built a throwaway app
 * with two stub routes, so it could never have caught the production
 * entrypoint missing its error handler or the subscriptions router.
 */

import request from 'supertest';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.CRON_SECRET = 'test-cron-secret-value-at-least-32-chars';

jest.mock('../../src/config/firebase', () => ({
  db: null,
  auth: null,
  storage: null,
}));

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Keep the limiter off the network; it must still meter in memory.
jest.mock('../../src/utils/upstashCache', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    invalidatePattern: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn(),
    rateLimitIncrement: jest.fn().mockResolvedValue(null),
    isAvailable: jest.fn().mockReturnValue(false),
    getStats: jest.fn().mockReturnValue({ memorySize: 0, upstashAvailable: false, lastHealthCheck: 0 }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const app: Express = require('../../src/index').default;

describe('API integration', () => {
  describe('health', () => {
    it('reports ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('route mounting', () => {
    // Every feature router must be reachable on the deployed app.
    // /api/subscriptions in particular used to 404 in production because
    // it was mounted in src/index.ts but not in the Vercel entrypoint.
    // Probed via a route each router actually declares - users, receipts and
    // stocks have no bare GET '/', so asking for one would test the test.
    const routes = [
      '/api/expenses',
      '/api/users/profile',
      '/api/budgets',
      '/api/notifications',
      '/api/goals',
      '/api/bill-reminders',
      '/api/stocks/trending',
      '/api/net-worth/assets',
      '/api/dashboard',
      '/api/subscriptions',
    ];

    it.each(routes)('mounts %s', async (path) => {
      const res = await request(app).get(path);

      // Unauthenticated, so anything except "no such route" proves it mounted
      expect(res.status).not.toBe(404);
    });
  });

  describe('error responses', () => {
    it('returns a JSON envelope for unknown routes', async () => {
      const res = await request(app).get('/api/does-not-exist');

      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body).toMatchObject({ success: false });
    });

    it('returns a JSON envelope for auth failures rather than HTML', async () => {
      // Without the global error handler mounted, AppError fell through to
      // Express's default finalhandler and produced an HTML body.
      const res = await request(app).get('/api/expenses');

      expect(res.status).toBe(401);
      expect(res.type).toBe('application/json');
      expect(res.body.success).toBe(false);
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('cron authentication', () => {
    it('rejects budget-alert runs without the shared secret', async () => {
      const res = await request(app).post('/api/notifications/check-budget-alerts');

      expect(res.status).toBe(401);
    });

    it('rejects an incorrect shared secret', async () => {
      const res = await request(app)
        .post('/api/notifications/check-budget-alerts')
        .set('x-cron-secret', 'wrong-value');

      expect(res.status).toBe(401);
    });
  });
});
