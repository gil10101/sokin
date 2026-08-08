/**
 * Route Authorization Integration Tests
 *
 * Boots the real Express app and asserts that every route touching a user's
 * financial data is actually behind the Firebase auth middleware. A route is
 * only as protected as its middleware chain, and a chain is edited one line at
 * a time - dropping `auth` from a single `router.put(...)` exposes that
 * resource for every user, and nothing else in the suite would notice.
 *
 * The assertions are deliberately chosen so a controller's own
 * `if (!req.user?.uid)` guard cannot stand in for the middleware. Both produce
 * 401, so a bare status check would pass even with `auth` removed. Firebase
 * Admin is unavailable in this suite, so only the middleware can answer a
 * presented token with 503 - a controller reached without `auth` answers 401
 * (or, for handlers that never read req.user, 200).
 *
 * Lives in its own file so it gets its own module registry: the global rate
 * limiter keeps a per-process counter, and sharing a file with the rest of the
 * integration suite would meter these probes into 429s instead of the statuses
 * they are asserting. Each request also carries a distinct forwarded IP, since
 * the limiter keys anonymous traffic by address.
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

// Keep the limiter off the network; it still meters in memory.
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

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

let probeCount = 0;

/** A fresh source address per probe, so the shared limiter never fires. */
const nextProbeIp = (): string => {
  probeCount += 1;
  return `10.${Math.floor(probeCount / 256) % 256}.${probeCount % 256}.1`;
};

/**
 * Every route whose handler reads or writes a user's own records. Path
 * parameters carry plausible values so a request that got past `auth` would
 * reach the controller rather than being turned away by parameter validation -
 * otherwise a missing `auth` could hide behind a 400.
 */
const PRIVATE_ROUTES: Array<[Method, string]> = [
  // Expenses
  ['get', '/api/expenses'],
  ['get', '/api/expenses/analytics'],
  ['get', '/api/expenses/abcdefgh12345678'],
  ['post', '/api/expenses'],
  ['put', '/api/expenses/abcdefgh12345678'],
  ['delete', '/api/expenses/abcdefgh12345678'],

  // Budgets
  ['get', '/api/budgets'],
  ['get', '/api/budgets/abcdefgh12345678'],
  ['post', '/api/budgets'],
  ['put', '/api/budgets/abcdefgh12345678'],
  ['delete', '/api/budgets/abcdefgh12345678'],

  // Users and profile
  ['get', '/api/users/profile'],
  ['put', '/api/users/profile'],
  ['post', '/api/users'],
  ['get', '/api/users/abcdefghijklmnopqrstuvwx'],
  ['put', '/api/users/abcdefghijklmnopqrstuvwx'],
  ['get', '/api/users/abcdefghijklmnopqrstuvwx/categories'],
  ['put', '/api/users/abcdefghijklmnopqrstuvwx/categories'],

  // Goals
  ['get', '/api/goals'],
  ['post', '/api/goals'],
  ['post', '/api/goals/abcdefgh12345678/contribute'],
  ['put', '/api/goals/abcdefgh12345678'],
  ['delete', '/api/goals/abcdefgh12345678'],

  // Bill reminders
  ['get', '/api/bill-reminders'],
  ['post', '/api/bill-reminders'],
  ['post', '/api/bill-reminders/abcdefgh12345678/pay'],
  ['put', '/api/bill-reminders/abcdefgh12345678'],
  ['delete', '/api/bill-reminders/abcdefgh12345678'],

  // Subscriptions
  ['get', '/api/subscriptions'],
  ['post', '/api/subscriptions'],
  ['put', '/api/subscriptions/abcdefgh12345678'],
  ['delete', '/api/subscriptions/abcdefgh12345678'],

  // Net worth
  ['get', '/api/net-worth/assets'],
  ['post', '/api/net-worth/assets'],
  ['put', '/api/net-worth/assets/abcdefgh12345678'],
  ['delete', '/api/net-worth/assets/abcdefgh12345678'],
  ['get', '/api/net-worth/liabilities'],
  ['post', '/api/net-worth/liabilities'],
  ['put', '/api/net-worth/liabilities/abcdefgh12345678'],
  ['delete', '/api/net-worth/liabilities/abcdefgh12345678'],
  ['get', '/api/net-worth/calculate'],
  ['get', '/api/net-worth/history'],
  ['get', '/api/net-worth/trends'],
  ['get', '/api/net-worth/insights'],

  // Dashboard
  ['get', '/api/dashboard'],

  // Notifications
  ['get', '/api/notifications'],
  ['post', '/api/notifications'],
  ['patch', '/api/notifications/abcdefgh12345678/read'],
  ['patch', '/api/notifications/read-all'],
  ['patch', '/api/notifications/abcdefgh12345678/dismiss'],
  ['patch', '/api/notifications/dismiss-all'],
  ['delete', '/api/notifications/abcdefgh12345678'],
  ['get', '/api/notifications/preferences'],
  ['put', '/api/notifications/preferences'],
  ['post', '/api/notifications/fcm-token'],

  // Receipts
  ['post', '/api/receipts/process'],

  // Stocks - the private half
  ['get', '/api/stocks/portfolio'],
  ['post', '/api/stocks/transaction'],
  ['get', '/api/stocks/max-sell/AAPL'],
  ['get', '/api/stocks/transactions'],
  ['get', '/api/stocks/watchlist'],
  ['post', '/api/stocks/watchlist'],
  ['put', '/api/stocks/watchlist'],
  ['delete', '/api/stocks/watchlist/AAPL'],

  // AI
  ['get', '/api/ai/status'],
  ['post', '/api/ai/categorize'],
  ['get', '/api/ai/insights'],
];

describe('route authorization', () => {
  describe.each(PRIVATE_ROUTES)('%s %s', (method, path) => {
    it('rejects a request carrying no bearer token', async () => {
      const res = await request(app)[method](path).set('X-Forwarded-For', nextProbeIp());

      expect(res.status).toBe(401);
      // The middleware's own wording. A controller-level guard reached without
      // `auth` says "User ID missing" instead, so matching here keeps the two
      // apart.
      expect(res.body.error).toMatch(/no token provided/i);
    });

    it('refuses a presented token rather than falling through to the handler', async () => {
      const res = await request(app)[method](path)
        .set('X-Forwarded-For', nextProbeIp())
        .set('Authorization', 'Bearer forged.jwt.value');

      // Only the auth middleware can produce 503 here: with Firebase Admin
      // unavailable it fails closed. Reaching a controller without `auth`
      // yields 401, or 200 for handlers that never read req.user.
      expect(res.status).toBe(503);
    });
  });

  describe('deliberately public routes', () => {
    // Market data carries no user data and is intentionally reachable without
    // a token. Listed explicitly so that making one of them private, or a
    // private route public, is a visible diff rather than a silent change of
    // posture.
    const PUBLIC_ROUTES: Array<[Method, string]> = [
      ['get', '/api/stocks/market-indices'],
      ['get', '/api/stocks/trending'],
      ['get', '/api/stocks/search'],
      ['get', '/api/stocks/stock/AAPL'],
      ['get', '/health'],
    ];

    it.each(PUBLIC_ROUTES)('%s %s does not require a token', async (method, path) => {
      const res = await request(app)[method](path).set('X-Forwarded-For', nextProbeIp());

      expect(res.status).not.toBe(401);
    });
  });
});
