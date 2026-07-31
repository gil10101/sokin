/**
 * Dashboard Controller Unit Tests
 *
 * Tests dashboard data aggregation, caching behavior, and error handling.
 *
 * The spending metrics are covered against a fake Firestore that really filters,
 * sorts, limits and aggregates rows, so the month-window boundaries are exercised
 * end to end rather than asserted against a hand-written stub value.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getDashboard,
  invalidateDashboardCache,
  buildMetricWindows,
  computeSpendingMetrics,
} from '../../../src/controllers/dashboardController';

// Mock cache - all async methods
jest.mock('../../../src/utils/cache', () => ({
  __esModule: true,
  default: {
    getAsync: jest.fn(),
    setAsync: jest.fn(),
    delAsync: jest.fn(),
    invalidatePatternAsync: jest.fn(),
  },
  CACHE_TTL: {
    SINGLE_ITEM: 30,
    LIST_QUERY: 30,
    DASHBOARD: 600,
    PORTFOLIO: 15,
    USER_SETTINGS: 600,
  },
}));

/**
 * Fake Firestore: stores rows in memory and implements the slice of the query
 * API the controller uses (where / orderBy / limit / get / aggregate).
 */
jest.mock('../../../src/config/firebase', () => {
  type Row = { id: string; [key: string]: unknown };
  type Where = [string, string, unknown];

  const state = {
    rows: { expenses: [], budgets: [], notifications: [] } as Record<string, Row[]>,
    failCollection: {} as Record<string, boolean>,
    failAggregate: false,
    queries: [] as Array<{
      collection: string;
      wheres: Where[];
      orderBys: Array<[string, string]>;
      limit: number | null;
      aggregate: Record<string, { aggregateType: string; _field?: string }> | null;
    }>,
  };

  /**
   * Firestore sorts by type before value, so a string bound never matches a
   * Timestamp value and vice versa. The fake reproduces that: comparisons only
   * happen within a type, otherwise the row simply does not match.
   */
  const kindOf = (value: unknown): string => {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'time';
    if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return 'time';
    return 'other';
  };

  const asMillis = (value: unknown): number =>
    value instanceof Date ? value.getTime() : (value as { toMillis: () => number }).toMillis();

  const matches = (row: Row, [field, op, value]: Where): boolean => {
    const rowValue = row[field];
    if (op === '==') {
      return rowValue === value;
    }
    const kind = kindOf(rowValue);
    if (kind !== kindOf(value) || kind === 'other') {
      return false;
    }
    const actual = (kind === 'time' ? asMillis(rowValue) : rowValue) as never;
    const expected = (kind === 'time' ? asMillis(value) : value) as never;
    switch (op) {
      case '>=':
        return actual >= expected;
      case '<=':
        return actual <= expected;
      case '>':
        return actual > expected;
      case '<':
        return actual < expected;
      default:
        throw new Error(`fake firestore: unsupported operator ${op}`);
    }
  };

  type QueryRecord = {
    collection: string;
    wheres: Where[];
    orderBys: Array<[string, string]>;
    limit: number | null;
    aggregate: Record<string, { aggregateType: string; _field?: string }> | null;
  };

  // Firestore queries are immutable - every where()/orderBy()/limit() returns a
  // new query. The fake copies too, otherwise five range queries built from one
  // collection reference would pile their filters onto a single object.
  const buildQuery = (collection: string, seed?: QueryRecord) => {
    const record: QueryRecord = seed ?? {
      collection,
      wheres: [],
      orderBys: [],
      limit: null,
      aggregate: null,
    };
    const derive = (patch: Partial<QueryRecord>) =>
      buildQuery(collection, { ...record, ...patch });

    const resolve = (): Row[] => {
      if (state.failCollection[collection]) {
        throw new Error(`fake firestore: ${collection} query failed`);
      }
      let rows = (state.rows[collection] || []).filter((row) =>
        record.wheres.every((where) => matches(row, where))
      );
      // Apply sort keys right-to-left so the first orderBy is the primary key.
      const typeRank = (value: unknown) => ['number', 'time', 'string', 'other'].indexOf(kindOf(value));
      for (const [field, direction] of [...record.orderBys].reverse()) {
        rows = [...rows].sort((a, b) => {
          const av = a[field];
          const bv = b[field];
          // Firestore orders by type first, then by value within the type.
          let cmp = typeRank(av) - typeRank(bv);
          if (cmp === 0) {
            const left = (kindOf(av) === 'time' ? asMillis(av) : av) as never;
            const right = (kindOf(bv) === 'time' ? asMillis(bv) : bv) as never;
            cmp = left < right ? -1 : left > right ? 1 : 0;
          }
          return direction === 'desc' ? -cmp : cmp;
        });
      }
      return record.limit === null ? rows : rows.slice(0, record.limit);
    };

    return {
      where: (field: string, op: string, value: unknown) =>
        derive({ wheres: [...record.wheres, [field, op, value] as Where] }),
      orderBy: (field: string, direction = 'asc') =>
        derive({ orderBys: [...record.orderBys, [field, direction] as [string, string]] }),
      limit: (n: number) => derive({ limit: n }),
      // Queries are recorded when they execute, so assertions see exactly the
      // five aggregations the controller runs and nothing it merely built.
      get: async () => {
        state.queries.push({ ...record });
        const rows = resolve();
        return {
          size: rows.length,
          empty: rows.length === 0,
          docs: rows.map(({ id, ...data }) => ({ id, data: () => data })),
        };
      },
      aggregate: (spec: Record<string, { aggregateType: string; _field?: string }>) => ({
        get: async () => {
          state.queries.push({ ...record, aggregate: spec });
          if (state.failAggregate) {
            throw new Error('9 FAILED_PRECONDITION: The query requires an index.');
          }
          const rows = resolve();
          const data: Record<string, number> = {};
          for (const [key, field] of Object.entries(spec)) {
            data[key] =
              field.aggregateType === 'count'
                ? rows.length
                : rows.reduce((sum, row) => {
                    const value = row[field._field as string];
                    return sum + (typeof value === 'number' ? value : 0);
                  }, 0);
          }
          return { data: () => data };
        },
      }),
    };
  };

  return {
    db: { collection: jest.fn((name: string) => buildQuery(name)) },
    __state: state,
  };
});

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { Timestamp } from 'firebase-admin/firestore';
import cache from '../../../src/utils/cache';
import logger from '../../../src/utils/logger';

type FakeRow = { id: string; [key: string]: unknown };
type FakeQuery = {
  collection: string;
  wheres: Array<[string, string, unknown]>;
  orderBys: Array<[string, string]>;
  limit: number | null;
  aggregate: Record<string, { aggregateType: string; _field?: string }> | null;
};

const firebaseMock = jest.requireMock('../../../src/config/firebase') as {
  db: { collection: jest.Mock };
  __state: {
    rows: Record<string, FakeRow[]>;
    failCollection: Record<string, boolean>;
    failAggregate: boolean;
    queries: FakeQuery[];
  };
};
const fake = firebaseMock.__state;

const USER = 'user-123';

/** Build an expense row. `date` is stored the way the API writes it: an ISO string. */
const expense = (id: string, date: string, amount: number, userId = USER): FakeRow => ({
  id,
  userId,
  name: id,
  amount,
  date,
  category: 'Food',
});

/** Build an expense row whose `date` is a Firestore Timestamp, as older rows are. */
const timestampExpense = (id: string, date: string, amount: number, userId = USER): FakeRow => ({
  ...expense(id, date, amount, userId),
  date: Timestamp.fromDate(new Date(date)),
});

const setExpenses = (rows: FakeRow[]) => {
  fake.rows.expenses = rows;
};

/** Aggregation queries issued against the expenses collection, in call order. */
const metricQueries = (): FakeQuery[] =>
  fake.queries.filter((q) => q.collection === 'expenses' && q.aggregate !== null);

/** The [start, end] date bounds of an aggregation query. */
const boundsOf = (query: FakeQuery): [unknown, unknown] => [
  query.wheres.find((w) => w[0] === 'date' && w[1] === '>=')?.[2],
  query.wheres.find((w) => w[0] === 'date' && w[1] === '<=')?.[2],
];

describe('Dashboard Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockNext = jest.fn();

    mockRequest = {
      user: { uid: USER, email: 'test@example.com' },
      params: {},
      body: {},
      query: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();

    fake.rows = {
      expenses: [
        expense('expense-123', '2026-07-15T00:00:00.000Z', 150),
        expense('expense-124', '2026-07-14T00:00:00.000Z', 90),
      ],
      budgets: [
        { id: 'budget-123', userId: USER, name: 'Monthly Food', amount: 500, period: 'monthly', currentSpent: 150 },
      ],
      notifications: [
        { id: 'notification-123', userId: USER, type: 'budget_warning', title: 'Budget Alert', read: false },
      ],
    };
    fake.failCollection = {};
    fake.failAggregate = false;
    fake.queries = [];

    // Reset cache mocks
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.delAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getDashboard', () => {
    it('should return dashboard data for authenticated user', async () => {
      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            expenses: expect.any(Array),
            budgets: expect.any(Array),
            notifications: expect.any(Array),
            metrics: expect.any(Object),
          }),
        })
      );
    });

    it('should return cached dashboard when available', async () => {
      const cachedResult = {
        expenses: [{ id: 'exp-1', name: 'Cached Expense', amount: 100 }],
        budgets: [{ id: 'bud-1', name: 'Cached Budget', amount: 500 }],
        notifications: [{ id: 'not-1', title: 'Cached Notification' }],
        metrics: { totalThisMonth: 42 },
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({ success: true, data: cachedResult });
      expect(firebaseMock.db.collection).not.toHaveBeenCalled();
    });

    it('should cache dashboard after database fetch', async () => {
      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(cache.setAsync).toHaveBeenCalledWith(
        'dashboard:v2:user-123',
        expect.objectContaining({
          expenses: expect.any(Array),
          budgets: expect.any(Array),
          notifications: expect.any(Array),
          metrics: expect.any(Object),
        }),
        600 // CACHE_TTL.DASHBOARD
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should fetch data in parallel for optimal performance', async () => {
      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(firebaseMock.db.collection).toHaveBeenCalledWith('expenses');
      expect(firebaseMock.db.collection).toHaveBeenCalledWith('budgets');
      expect(firebaseMock.db.collection).toHaveBeenCalledWith('notifications');
    });

    it('should include correct number of items per collection', async () => {
      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.expenses.length).toBe(2);
      expect(response.data.budgets.length).toBe(1);
      expect(response.data.notifications.length).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      firebaseMock.db.collection.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should still return budgets and notifications when the expense feed fails', async () => {
      fake.failCollection.expenses = true;

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.expenses).toEqual([]);
      expect(response.data.budgets.length).toBe(1);
      expect(response.data.metrics).toBeNull();
    });
  });

  describe('getDashboard spending metrics', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T10:00:00.000Z'));
    });

    it('should aggregate totals over every expense, not the capped feed', async () => {
      // 120 expenses this month: more than double the 50-row feed cap.
      const rows: FakeRow[] = [];
      for (let i = 0; i < 120; i++) {
        rows.push(expense(`mtd-${i}`, `2026-07-${String((i % 15) + 1).padStart(2, '0')}T09:00:00.000Z`, 10));
      }
      setExpenses(rows);

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      const { data } = jsonMock.mock.calls[0][0];
      // The feed is still capped - it drives the recent transactions panel.
      expect(data.expenses).toHaveLength(50);
      // The money numbers are not.
      expect(data.metrics.totalThisMonth).toBe(1200);
      expect(data.metrics.countThisMonth).toBe(120);
      // Guard against a regression back to reducing over the capped array.
      const cappedTotal = data.expenses.reduce(
        (sum: number, e: { amount: number }) => sum + e.amount,
        0
      );
      expect(cappedTotal).toBe(500);
      expect(data.metrics.totalThisMonth).not.toBe(cappedTotal);
    });

    it('should report a real six-month trend for a user whose feed is full of recent rows', async () => {
      const rows: FakeRow[] = [];
      // 60 recent expenses - enough to fill the capped feed on their own.
      for (let i = 0; i < 60; i++) {
        rows.push(expense(`recent-${i}`, `2026-07-${String((i % 15) + 1).padStart(2, '0')}T09:00:00.000Z`, 10));
      }
      // Older six-month block (2025-07 .. 2025-12), invisible to the capped feed.
      rows.push(expense('older-1', '2025-08-10T00:00:00.000Z', 300));
      rows.push(expense('older-2', '2025-11-10T00:00:00.000Z', 300));
      // Recent six-month block (2026-01 .. 2026-06).
      rows.push(expense('recent-block-1', '2026-03-10T00:00:00.000Z', 600));
      setExpenses(rows);

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      const { data } = jsonMock.mock.calls[0][0];
      expect(data.expenses).toHaveLength(50);
      // Every feed row is inside the recent window, so a capped-array trend is
      // structurally 0%. The aggregate knows better.
      expect(
        data.expenses.filter((e: { date: string }) => e.date < '2026-01-01T00:00:00.000Z')
      ).toHaveLength(0);
      expect(data.metrics.avgMonthly6).toBe(100); // 600 / 6
      expect(data.metrics.avgMonthlyPrev6).toBe(100); // 600 / 6
      expect(data.metrics.avgChangePct).toBe(0);

      // ... and a genuine change is reported as a genuine change.
      setExpenses([...rows, expense('recent-block-2', '2026-04-10T00:00:00.000Z', 600)]);
      jsonMock.mockClear();
      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);
      expect(jsonMock.mock.calls[0][0].data.metrics.avgChangePct).toBe(100);
    });

    it('should return null metrics - not zeroes - when aggregation fails', async () => {
      fake.failAggregate = true;

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      const { data } = jsonMock.mock.calls[0][0];
      expect(data.metrics).toBeNull();
      expect(data.expenses.length).toBeGreaterThan(0);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to aggregate dashboard spending metrics',
        expect.objectContaining({ userId: USER })
      );
    });

    it('should not cache a payload whose metrics failed to compute', async () => {
      fake.failAggregate = true;

      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      expect(cache.setAsync).not.toHaveBeenCalled();
    });

    it('should keep the expense feed capped at 50 and ordered newest first', async () => {
      await getDashboard(mockRequest as Request, mockResponse as Response, mockNext);

      const feed = fake.queries.find((q) => q.collection === 'expenses' && q.aggregate === null);
      expect(feed?.limit).toBe(50);
      expect(feed?.orderBys).toEqual([['date', 'desc']]);
    });
  });

  describe('buildMetricWindows', () => {
    it('should describe the current month, previous month and both six-month blocks', () => {
      expect(buildMetricWindows(new Date('2026-07-15T10:00:00.000Z'))).toEqual({
        monthStart: '2026-07-01T00:00:00.000Z',
        monthToDateEnd: '2026-07-15T23:59:59.999Z',
        lastMonthStart: '2026-06-01T00:00:00.000Z',
        lastMonthToDateEnd: '2026-06-15T23:59:59.999Z',
        lastMonthFullEnd: '2026-06-30T23:59:59.999Z',
        sixMonthStart: '2026-01-01T00:00:00.000Z',
        sixMonthEnd: '2026-06-30T23:59:59.999Z',
        twelveMonthStart: '2025-07-01T00:00:00.000Z',
        twelveMonthEnd: '2025-12-31T23:59:59.999Z',
        elapsedDays: 15,
      });
    });

    it('should clamp the comparison window to a shorter previous month', () => {
      const windows = buildMetricWindows(new Date('2026-03-31T18:00:00.000Z'));

      expect(windows.elapsedDays).toBe(28);
      expect(windows.lastMonthToDateEnd).toBe('2026-02-28T23:59:59.999Z');
      // The clamped window is the whole of February, which is the closest
      // like-for-like comparison that exists.
      expect(windows.lastMonthToDateEnd).toBe(windows.lastMonthFullEnd);
    });

    it('should clamp to 29 days when the previous February is a leap month', () => {
      const windows = buildMetricWindows(new Date('2024-03-31T18:00:00.000Z'));

      expect(windows.elapsedDays).toBe(29);
      expect(windows.lastMonthToDateEnd).toBe('2024-02-29T23:59:59.999Z');
      expect(windows.lastMonthFullEnd).toBe('2024-02-29T23:59:59.999Z');
    });

    it('should handle the leap day itself', () => {
      const windows = buildMetricWindows(new Date('2024-02-29T12:00:00.000Z'));

      expect(windows.monthStart).toBe('2024-02-01T00:00:00.000Z');
      expect(windows.monthToDateEnd).toBe('2024-02-29T23:59:59.999Z');
      expect(windows.elapsedDays).toBe(29); // January has 31 days, no clamping
      expect(windows.lastMonthToDateEnd).toBe('2024-01-29T23:59:59.999Z');
      expect(windows.lastMonthFullEnd).toBe('2024-01-31T23:59:59.999Z');
    });

    it('should clamp a 31st against a 30-day previous month', () => {
      const windows = buildMetricWindows(new Date('2026-05-31T23:59:00.000Z'));

      expect(windows.elapsedDays).toBe(30);
      expect(windows.lastMonthToDateEnd).toBe('2026-04-30T23:59:59.999Z');
    });

    it('should not clamp a 31st against a 31-day previous month', () => {
      const windows = buildMetricWindows(new Date('2026-01-31T08:00:00.000Z'));

      expect(windows.elapsedDays).toBe(31);
      expect(windows.lastMonthToDateEnd).toBe('2025-12-31T23:59:59.999Z');
      expect(windows.lastMonthStart).toBe('2025-12-01T00:00:00.000Z');
    });

    it('should roll over the year correctly on the first of January', () => {
      const windows = buildMetricWindows(new Date('2026-01-01T00:00:01.000Z'));

      expect(windows).toEqual({
        monthStart: '2026-01-01T00:00:00.000Z',
        monthToDateEnd: '2026-01-01T23:59:59.999Z',
        lastMonthStart: '2025-12-01T00:00:00.000Z',
        lastMonthToDateEnd: '2025-12-01T23:59:59.999Z',
        lastMonthFullEnd: '2025-12-31T23:59:59.999Z',
        sixMonthStart: '2025-07-01T00:00:00.000Z',
        sixMonthEnd: '2025-12-31T23:59:59.999Z',
        twelveMonthStart: '2025-01-01T00:00:00.000Z',
        twelveMonthEnd: '2025-06-30T23:59:59.999Z',
        elapsedDays: 1,
      });
    });

    it('should produce contiguous, non-overlapping blocks', () => {
      for (const iso of [
        '2026-07-15T10:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
        '2024-02-29T23:00:00.000Z',
        '2026-03-31T00:00:00.000Z',
        '2025-12-31T23:59:59.000Z',
      ]) {
        const w = buildMetricWindows(new Date(iso));

        expect(Date.parse(w.twelveMonthEnd) + 1).toBe(Date.parse(w.sixMonthStart));
        expect(Date.parse(w.sixMonthEnd) + 1).toBe(Date.parse(w.monthStart));
        expect(w.lastMonthFullEnd).toBe(w.sixMonthEnd);
        expect(Date.parse(w.lastMonthStart)).toBeGreaterThan(Date.parse(w.sixMonthStart) - 1);
        expect(Date.parse(w.lastMonthToDateEnd)).toBeLessThanOrEqual(Date.parse(w.lastMonthFullEnd));
        // Both six-month blocks span exactly six months.
        expect(Date.parse(w.twelveMonthStart)).toBeLessThan(Date.parse(w.sixMonthStart));
        for (const bound of [w.monthStart, w.lastMonthStart, w.sixMonthStart, w.twelveMonthStart]) {
          expect(bound.endsWith('T00:00:00.000Z')).toBe(true);
        }
        for (const bound of [
          w.monthToDateEnd,
          w.lastMonthToDateEnd,
          w.lastMonthFullEnd,
          w.sixMonthEnd,
          w.twelveMonthEnd,
        ]) {
          expect(bound.endsWith('T23:59:59.999Z')).toBe(true);
        }
      }
    });

    it('should bucket by UTC rather than the server timezone', () => {
      // 00:30 UTC on the 1st is still the previous month in any negative offset.
      expect(buildMetricWindows(new Date('2026-08-01T00:30:00.000Z')).monthStart).toBe(
        '2026-08-01T00:00:00.000Z'
      );
      expect(buildMetricWindows(new Date('2026-07-31T23:30:00.000Z')).monthStart).toBe(
        '2026-07-01T00:00:00.000Z'
      );
    });

    it('should default to the current time', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-10T05:00:00.000Z'));

      expect(buildMetricWindows().monthStart).toBe('2026-04-01T00:00:00.000Z');
      expect(buildMetricWindows().elapsedDays).toBe(10);
    });
  });

  describe('computeSpendingMetrics', () => {
    const NOW = new Date('2026-07-15T10:00:00.000Z');

    it('should query Firestore with an explicit date ordering so the sum index applies', async () => {
      setExpenses([]);

      await computeSpendingMetrics(USER, NOW);

      // Five windows, each asked for both `date` representations.
      const queries = metricQueries();
      expect(queries).toHaveLength(10);
      for (const query of queries) {
        expect(query.wheres[0]).toEqual(['userId', '==', USER]);
        expect(query.wheres.map((w) => `${w[0]} ${w[1]}`)).toEqual([
          'userId ==',
          'date >=',
          'date <=',
        ]);
        // Load-bearing: without it Firestore orders ascending and demands an
        // index that is not deployed. See the comment in the controller.
        expect(query.orderBys).toEqual([['date', 'desc']]);
        // Aggregations must not pull documents back.
        expect(query.limit).toBeNull();
      }
    });

    it('should ask Firestore for sums and counts instead of fetching rows', async () => {
      setExpenses([]);

      await computeSpendingMetrics(USER, NOW);

      const [stringMtd, timestampMtd, ...rest] = metricQueries();
      for (const query of [stringMtd, timestampMtd]) {
        expect(query.aggregate).toEqual({
          total: expect.objectContaining({ aggregateType: 'sum', _field: 'amount' }),
          count: expect.objectContaining({ aggregateType: 'count' }),
        });
      }
      for (const query of rest) {
        expect(query.aggregate).toEqual({
          total: expect.objectContaining({ aggregateType: 'sum', _field: 'amount' }),
        });
      }
      // No document-returning read against expenses at all.
      expect(fake.queries.filter((q) => q.collection === 'expenses' && q.aggregate === null)).toHaveLength(0);
    });

    it('should aggregate each window over the windows built for the instant', async () => {
      setExpenses([]);

      await computeSpendingMetrics(USER, NOW);

      const w = buildMetricWindows(NOW);
      // String lower bounds are the bare calendar day so date-only rows landing
      // on the 1st are not sorted underneath a full-timestamp floor.
      const pair = (start: string, end: string) => [
        [start.slice(0, 10), end],
        [new Date(start), new Date(end)],
      ];
      expect(metricQueries().map(boundsOf)).toEqual([
        ...pair(w.monthStart, w.monthToDateEnd),
        ...pair(w.lastMonthStart, w.lastMonthToDateEnd),
        ...pair(w.lastMonthStart, w.lastMonthFullEnd),
        ...pair(w.sixMonthStart, w.sixMonthEnd),
        ...pair(w.twelveMonthStart, w.twelveMonthEnd),
      ]);
    });

    it('should return zeroes and null comparisons for a user with no expenses', async () => {
      setExpenses([]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics).toMatchObject({
        totalThisMonth: 0,
        countThisMonth: 0,
        totalLastMonth: 0,
        totalLastMonthFull: 0,
        avgMonthly6: 0,
        avgMonthlyPrev6: 0,
        // Null, not 0: there is no baseline, so there is no "no change".
        monthOverMonthChangePct: null,
        avgChangePct: null,
      });
    });

    it('should split expenses that straddle a month boundary', async () => {
      setExpenses([
        expense('last-month-final-ms', '2026-06-30T23:59:59.999Z', 11),
        expense('this-month-first-ms', '2026-07-01T00:00:00.000Z', 22),
        expense('last-month-first-ms', '2026-06-01T00:00:00.000Z', 33),
        expense('two-months-ago', '2026-05-31T23:59:59.999Z', 44),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(22);
      expect(metrics.countThisMonth).toBe(1);
      expect(metrics.totalLastMonthFull).toBe(44); // 11 + 33
      // May and June both land in the recent six-month block: 11 + 33 + 44.
      expect(metrics.avgMonthly6).toBe(14.67); // 88 / 6, rounded to cents
      expect(metrics.avgMonthlyPrev6).toBe(0);
    });

    it('should compare like with like across the same elapsed days', async () => {
      setExpenses([
        expense('lm-early', '2026-06-10T12:00:00.000Z', 100), // within day 15
        expense('lm-cutoff', '2026-06-15T23:59:59.999Z', 5), // last instant of day 15
        expense('lm-late', '2026-06-16T00:00:00.000Z', 900), // after the cutoff
        expense('mtd', '2026-07-10T12:00:00.000Z', 105),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalLastMonth).toBe(105); // days 1-15 only
      expect(metrics.totalLastMonthFull).toBe(1005); // the whole month
      expect(metrics.totalThisMonth).toBe(105);
      // Month-to-date against the same elapsed window: flat, not a fake -89.6%.
      expect(metrics.monthOverMonthChangePct).toBe(0);
    });

    it('should not compare a partial month against a complete one', async () => {
      // Identical daily spend in both months; a partial-vs-full comparison
      // would report a large fake decline halfway through the month.
      const rows: FakeRow[] = [];
      for (let day = 1; day <= 30; day++) {
        rows.push(expense(`jun-${day}`, `2026-06-${String(day).padStart(2, '0')}T12:00:00.000Z`, 10));
      }
      for (let day = 1; day <= 15; day++) {
        rows.push(expense(`jul-${day}`, `2026-07-${String(day).padStart(2, '0')}T12:00:00.000Z`, 10));
      }
      setExpenses(rows);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(150);
      expect(metrics.totalLastMonth).toBe(150);
      expect(metrics.monthOverMonthChangePct).toBe(0);
      expect(metrics.totalLastMonthFull).toBe(300);
    });

    it('should handle a user with expenses only in the older six-month window', async () => {
      setExpenses([
        expense('old-1', '2025-07-01T00:00:00.000Z', 600),
        expense('old-2', '2025-12-31T23:59:59.999Z', 600),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.avgMonthlyPrev6).toBe(200); // 1200 / 6
      expect(metrics.avgMonthly6).toBe(0);
      expect(metrics.avgChangePct).toBe(-100);
      expect(metrics.totalThisMonth).toBe(0);
      expect(metrics.monthOverMonthChangePct).toBeNull();
    });

    it('should exclude expenses older than the twelve-month window', async () => {
      setExpenses([
        expense('ancient', '2025-06-30T23:59:59.999Z', 5000),
        expense('oldest-counted', '2025-07-01T00:00:00.000Z', 60),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.avgMonthlyPrev6).toBe(10); // only the 60, over six months
      expect(metrics.avgMonthly6).toBe(0);
    });

    it('should divide by six months even when only one month has data', async () => {
      setExpenses([expense('one-month', '2026-03-10T00:00:00.000Z', 1200)]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.avgMonthly6).toBe(200);
    });

    it('should exclude the partial current month from the six-month average', async () => {
      setExpenses([
        expense('this-month', '2026-07-05T00:00:00.000Z', 9000),
        expense('in-block', '2026-02-05T00:00:00.000Z', 600),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      // 600 / 6, with the current month left out of the block entirely.
      expect(metrics.avgMonthly6).toBe(100);
      expect(metrics.totalThisMonth).toBe(9000);
    });

    it('should ignore expenses belonging to other users', async () => {
      setExpenses([
        expense('mine', '2026-07-10T00:00:00.000Z', 10),
        expense('theirs', '2026-07-10T00:00:00.000Z', 999, 'someone-else'),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(10);
      expect(metrics.countThisMonth).toBe(1);
    });

    it('should exclude future-dated expenses from the month-to-date total', async () => {
      setExpenses([
        expense('today', '2026-07-15T23:59:59.999Z', 10),
        expense('later-this-month', '2026-07-16T00:00:00.000Z', 500),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(10);
      expect(metrics.countThisMonth).toBe(1);
    });

    it('should bucket legacy date-only values on the correct side of a boundary', async () => {
      // Rows written before ISO normalization store a bare calendar date, which
      // sorts before the same day's full timestamp - a full-timestamp lower
      // bound would drop the one landing on the 1st.
      setExpenses([
        expense('legacy-this-month', '2026-07-01', 10),
        expense('legacy-last-month-end', '2026-06-30', 20),
        expense('legacy-mid-month', '2026-07-14', 30),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(40);
      expect(metrics.countThisMonth).toBe(2);
      expect(metrics.totalLastMonthFull).toBe(20);
    });

    it('should count expenses whose date is stored as a Firestore Timestamp', async () => {
      // Firestore orders by type before value, so these rows are invisible to a
      // string range query. Whole accounts store dates this way.
      setExpenses([
        timestampExpense('ts-this-month', '2026-07-10T12:00:00.000Z', 100),
        timestampExpense('ts-last-month-early', '2026-06-10T12:00:00.000Z', 40),
        timestampExpense('ts-last-month-late', '2026-06-20T12:00:00.000Z', 400),
        timestampExpense('ts-six-block', '2026-02-10T12:00:00.000Z', 600),
        timestampExpense('ts-older-block', '2025-09-10T12:00:00.000Z', 1200),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(100);
      expect(metrics.countThisMonth).toBe(1);
      expect(metrics.totalLastMonth).toBe(40); // same-elapsed window still applies
      expect(metrics.totalLastMonthFull).toBe(440);
      expect(metrics.avgMonthly6).toBe(173.33); // (40 + 400 + 600) / 6
      expect(metrics.avgMonthlyPrev6).toBe(200); // 1200 / 6
    });

    it('should add up accounts that mix string and Timestamp dates', async () => {
      setExpenses([
        expense('string-row', '2026-07-05T12:00:00.000Z', 10),
        expense('legacy-date-only', '2026-07-06', 5),
        timestampExpense('timestamp-row', '2026-07-07T12:00:00.000Z', 20),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(35);
      expect(metrics.countThisMonth).toBe(3);
    });

    it('should apply the same month boundary to Timestamp dates', async () => {
      setExpenses([
        timestampExpense('ts-last-ms-of-june', '2026-06-30T23:59:59.999Z', 7),
        timestampExpense('ts-first-ms-of-july', '2026-07-01T00:00:00.000Z', 9),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.totalThisMonth).toBe(9);
      expect(metrics.totalLastMonthFull).toBe(7);
    });

    it('should round money to cents and percentages to two decimals', async () => {
      setExpenses([
        expense('a', '2026-07-02T00:00:00.000Z', 0.1),
        expense('b', '2026-07-03T00:00:00.000Z', 0.2),
        expense('c', '2026-06-02T00:00:00.000Z', 0.3),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      // 0.1 + 0.2 is 0.30000000000000004 before rounding.
      expect(metrics.totalThisMonth).toBe(0.3);
      expect(metrics.totalLastMonth).toBe(0.3);
      expect(metrics.monthOverMonthChangePct).toBe(0);
    });

    it('should report percentage change against the previous month', async () => {
      setExpenses([
        expense('now', '2026-07-02T00:00:00.000Z', 150),
        expense('then', '2026-06-02T00:00:00.000Z', 100),
      ]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.monthOverMonthChangePct).toBe(50);
    });

    it('should expose the windows the numbers were aggregated over', async () => {
      setExpenses([]);

      const metrics = await computeSpendingMetrics(USER, NOW);

      expect(metrics.range).toEqual(buildMetricWindows(NOW));
    });

    it('should propagate aggregation failures to the caller', async () => {
      fake.failAggregate = true;

      await expect(computeSpendingMetrics(USER, NOW)).rejects.toThrow('FAILED_PRECONDITION');
    });
  });

  describe('invalidateDashboardCache', () => {
    it('should delete dashboard cache for user', async () => {
      await invalidateDashboardCache('user-123');

      expect(cache.delAsync).toHaveBeenCalledWith('dashboard:v2:user-123');
    });

    it('should not throw on cache deletion failure', async () => {
      (cache.delAsync as jest.Mock).mockRejectedValue(new Error('Cache error'));

      await expect(invalidateDashboardCache('user-123')).resolves.not.toThrow();
    });
  });
});
