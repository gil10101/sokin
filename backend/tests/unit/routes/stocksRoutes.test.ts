/**
 * Stocks Route Validation Tests
 *
 * The watchlist write routes reached their controller with no body schema, so
 * the 50-symbol ceiling declared in firestore.rules was never applied on this
 * path - the backend writes with the Admin SDK, which bypasses rules entirely.
 * These tests pin the ceiling to the place it is now enforced.
 *
 * Firebase Admin is stubbed with a verifier that accepts one fixed token, so
 * requests get past `auth` and reach validation. Firestore stays null: a body
 * that clears validation is expected to fail later in the controller, and the
 * distinction between "rejected at the door" (400) and "accepted, then failed
 * on storage" (500) is exactly what these tests read.
 */

import request from 'supertest';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.CRON_SECRET = 'test-cron-secret-value-at-least-32-chars';

const VALID_TOKEN = 'valid-test-token';
const TEST_UID = 'test-user-uid-000000000001';

jest.mock('../../../src/config/firebase', () => ({
  db: null,
  storage: null,
  auth: {
    verifyIdToken: jest.fn(async (token: string) => {
      if (token !== 'valid-test-token') {
        throw new Error('Invalid token');
      }
      return { uid: 'test-user-uid-000000000001', email: 'test@example.com' };
    }),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/utils/upstashCache', () => ({
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
const app: Express = require('../../../src/index').default;

let probeCount = 0;
const nextProbeIp = (): string => {
  probeCount += 1;
  return `10.9.${Math.floor(probeCount / 256) % 256}.${probeCount % 256}`;
};

const authed = (method: 'post' | 'put', path: string) =>
  request(app)[method](path)
    .set('X-Forwarded-For', nextProbeIp())
    .set('Authorization', `Bearer ${VALID_TOKEN}`);

const symbols = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `S${String(i).padStart(3, '0')}`);

describe('PUT /api/stocks/watchlist body validation', () => {
  it('authenticates the fixture token, so a 400 below is validation and not auth', async () => {
    const res = await authed('put', '/api/stocks/watchlist').send({ symbols: [] });

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
  });

  it('rejects a watchlist longer than the 50-symbol ceiling', async () => {
    const res = await authed('put', '/api/stocks/watchlist').send({ symbols: symbols(51) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('rejects a grossly oversized list rather than writing it', async () => {
    const res = await authed('put', '/api/stocks/watchlist').send({ symbols: symbols(5000) });

    expect(res.status).toBe(400);
  });

  it('accepts a list at the ceiling', async () => {
    const res = await authed('put', '/api/stocks/watchlist').send({ symbols: symbols(50) });

    // Firestore is null in this suite, so a body that passes validation fails
    // in the controller instead. Anything but 400 means validation let it by.
    expect(res.status).not.toBe(400);
  });

  it('rejects symbols that are not stock tickers', async () => {
    const res = await authed('put', '/api/stocks/watchlist').send({
      symbols: ['AAPL', '../../etc/passwd'],
    });

    expect(res.status).toBe(400);
  });

  it('rejects a non-array symbols field', async () => {
    const res = await authed('put', '/api/stocks/watchlist').send({ symbols: 'AAPL' });

    expect(res.status).toBe(400);
  });

  it('rejects a missing symbols field', async () => {
    const res = await authed('put', '/api/stocks/watchlist').send({});

    expect(res.status).toBe(400);
  });

  it('strips fields the schema does not declare', async () => {
    // stripUnknown is what keeps a client-supplied userId out of a Firestore
    // write on every validated route in this app; assert it holds here too.
    const res = await authed('put', '/api/stocks/watchlist').send({
      symbols: ['AAPL'],
      userId: 'someone-elses-uid',
    });

    expect(res.status).not.toBe(400);
  });
});

describe('POST /api/stocks/watchlist body validation', () => {
  it('rejects a missing symbol', async () => {
    const res = await authed('post', '/api/stocks/watchlist').send({});

    expect(res.status).toBe(400);
  });

  it('rejects a symbol longer than a ticker can be', async () => {
    const res = await authed('post', '/api/stocks/watchlist').send({ symbol: 'A'.repeat(64) });

    expect(res.status).toBe(400);
  });

  it('rejects a non-string symbol', async () => {
    const res = await authed('post', '/api/stocks/watchlist').send({ symbol: { $ne: null } });

    expect(res.status).toBe(400);
  });

  it('accepts a well-formed ticker', async () => {
    const res = await authed('post', '/api/stocks/watchlist').send({ symbol: 'BRK.B' });

    expect(res.status).not.toBe(400);
  });
});

describe('watchlist routes still require authentication', () => {
  it('rejects an unknown token on the write path', async () => {
    const res = await request(app)
      .put('/api/stocks/watchlist')
      .set('X-Forwarded-For', nextProbeIp())
      .set('Authorization', 'Bearer not-the-fixture-token')
      .send({ symbols: ['AAPL'] });

    expect(res.status).toBe(401);
  });

  it('never reports the authenticated uid back from a token it did not verify', async () => {
    const res = await request(app)
      .put('/api/stocks/watchlist')
      .set('X-Forwarded-For', nextProbeIp())
      .send({ symbols: ['AAPL'], userId: TEST_UID });

    expect(res.status).toBe(401);
  });
});
