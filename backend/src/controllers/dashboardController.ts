/**
 * Dashboard Controller
 * 
 * Provides aggregated dashboard data for the user including recent expenses,
 * active budgets, and unread notifications. Implements distributed caching
 * for performance in serverless environments.
 * 
 * @module controllers/dashboardController
 */

import { Request, Response, NextFunction } from 'express';
import { AggregateField } from 'firebase-admin/firestore';
import { db } from '../config/firebase';
import logger from '../utils/logger';
import cache, { CACHE_TTL } from '../utils/cache';
import { AppError } from '../middleware/errorHandler';

/** Maximum number of expenses to return in dashboard */
const MAX_DASHBOARD_EXPENSES = 50;

/** Maximum number of budgets to return in dashboard */
const MAX_DASHBOARD_BUDGETS = 20;

/** Maximum number of notifications to return in dashboard */
const MAX_DASHBOARD_NOTIFICATIONS = 5;

/** Number of months in each half of the six-month trend comparison */
const TREND_MONTHS = 6;

/**
 * Boundaries of every window the spending metrics are aggregated over.
 *
 * All values are UTC ISO-8601 strings describing the range each figure covers.
 * Every upper bound is *inclusive* and lands on `…T23:59:59.999Z`, which is after
 * every representation of that day. See {@link computeSpendingMetrics} for how
 * they are turned into Firestore bounds for each shape the `date` field takes.
 */
export interface DashboardMetricWindows {
  /** First instant of the current calendar month (UTC). */
  monthStart: string;
  /** End of the current UTC day - the month-to-date cut-off. */
  monthToDateEnd: string;
  /** First instant of the previous calendar month (UTC). */
  lastMonthStart: string;
  /** Same elapsed point in the previous month, clamped to that month's length. */
  lastMonthToDateEnd: string;
  /** Last instant of the previous calendar month. */
  lastMonthFullEnd: string;
  /** First instant of the month six complete months back. */
  sixMonthStart: string;
  /** Last instant before the current month - end of the recent six-month block. */
  sixMonthEnd: string;
  /** First instant of the month twelve complete months back. */
  twelveMonthStart: string;
  /** Last instant before `sixMonthStart` - end of the older six-month block. */
  twelveMonthEnd: string;
  /** Days of the month covered by both month-to-date windows (clamped). */
  elapsedDays: number;
}

/**
 * Spending aggregates computed server-side over the *complete* expense history.
 *
 * These deliberately do not come from the capped `expenses` array in the same
 * payload: that array is a 50-row recent-activity feed and reducing over it
 * silently truncates every total once a user passes 50 transactions.
 */
export interface DashboardSpendingMetrics {
  /** Sum of expenses from the 1st of this month through the end of today (UTC). */
  totalThisMonth: number;
  /** Number of expenses in that same month-to-date window. */
  countThisMonth: number;
  /** Previous month over the *same* elapsed days - comparable with `totalThisMonth`. */
  totalLastMonth: number;
  /** Previous month in full, for callers that want the closed-month figure. */
  totalLastMonthFull: number;
  /** Mean monthly spend over the six complete months before this one. */
  avgMonthly6: number;
  /** Mean monthly spend over the six complete months before those. */
  avgMonthlyPrev6: number;
  /** `totalThisMonth` vs `totalLastMonth`, in percent. Null when there is no baseline. */
  monthOverMonthChangePct: number | null;
  /** `avgMonthly6` vs `avgMonthlyPrev6`, in percent. Null when there is no baseline. */
  avgChangePct: number | null;
  /** The exact boundaries the numbers above were aggregated over. */
  range: DashboardMetricWindows;
}

/** Dashboard response payload type */
interface DashboardPayload {
  expenses: Array<{ id: string; [key: string]: unknown }>;
  budgets: Array<{ id: string; [key: string]: unknown }>;
  notifications: Array<{ id: string; [key: string]: unknown }>;
  /** Null when the aggregation queries failed - never fabricate zeroes. */
  metrics: DashboardSpendingMetrics | null;
}

/**
 * Build cache key for dashboard
 *
 * Versioned so that payloads cached before spending metrics existed are not
 * served back without them after a deploy.
 */
function buildDashboardCacheKey(userId: string): string {
  return `dashboard:v2:${userId}`;
}

/** First instant of a UTC month. Month index may overflow/underflow (Date.UTC normalizes). */
function startOfUtcMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}

/** Last instant of a UTC day. */
function endOfUtcDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999));
}

/** Number of days in a UTC month (day 0 of the next month is the last day of this one). */
function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Round a money value to cents, keeping float summation noise out of the payload. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Round a percentage to two decimals. */
function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Percentage change against a baseline.
 *
 * Returns null - not 0 - when there is nothing to compare against, so callers
 * cannot render a missing baseline as a confident "no change".
 */
function percentChange(current: number, baseline: number): number | null {
  if (!(baseline > 0)) {
    return null;
  }
  return roundPercent(((current - baseline) / baseline) * 100);
}

/** Coerce an aggregation result to a finite number. */
function toFiniteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Compute every window boundary the dashboard aggregates over.
 *
 * Pure date math (no I/O), exported so the month-boundary behaviour - short
 * months, leap days, year rollover - can be tested directly.
 *
 * The month-to-date windows are normalized: both cover days 1..N of their
 * month, where N is today's day-of-month clamped to the length of the shorter
 * month. Comparing a partial month against a *complete* previous month is what
 * made early-in-the-month dashboards always show a large fake decline.
 *
 * @param now - Instant to treat as "now" (defaults to the current time)
 */
export function buildMetricWindows(now: Date = new Date()): DashboardMetricWindows {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const dayOfMonth = now.getUTCDate();

  const monthStart = startOfUtcMonth(year, month);
  const lastMonthStart = startOfUtcMonth(year, month - 1);
  const lastMonthLength = daysInUtcMonth(year, month - 1);

  // Feb has no 31st: comparing Mar 1-31 to Feb 1-28 is the closest like-for-like
  // window that exists.
  const elapsedDays = Math.min(dayOfMonth, lastMonthLength);

  const sixMonthStart = startOfUtcMonth(year, month - TREND_MONTHS);
  const twelveMonthStart = startOfUtcMonth(year, month - TREND_MONTHS * 2);

  return {
    monthStart: monthStart.toISOString(),
    monthToDateEnd: endOfUtcDay(year, month, dayOfMonth).toISOString(),
    lastMonthStart: lastMonthStart.toISOString(),
    lastMonthToDateEnd: endOfUtcDay(year, month - 1, elapsedDays).toISOString(),
    // One millisecond before the current month begins.
    lastMonthFullEnd: new Date(monthStart.getTime() - 1).toISOString(),
    sixMonthStart: sixMonthStart.toISOString(),
    sixMonthEnd: new Date(monthStart.getTime() - 1).toISOString(),
    twelveMonthStart: twelveMonthStart.toISOString(),
    twelveMonthEnd: new Date(sixMonthStart.getTime() - 1).toISOString(),
    elapsedDays,
  };
}

/**
 * Aggregate the user's spending totals directly in Firestore.
 *
 * Uses `sum()`/`count()` aggregation queries so the totals cover every matching
 * expense without transferring - or capping - a single document.
 *
 * @param userId - Owner of the expenses
 * @param now - Instant to treat as "now" (defaults to the current time)
 * @throws AppError when Firestore is unavailable
 */
export async function computeSpendingMetrics(
  userId: string,
  now: Date = new Date()
): Promise<DashboardSpendingMetrics> {
  if (!db) {
    throw new AppError('Database not initialized', 500, false);
  }

  const range = buildMetricWindows(now);
  const expenses = db.collection('expenses');

  // The `.orderBy('date', 'desc')` is load-bearing, not cosmetic: a sum()
  // aggregation must be covered by an index that also contains the summed
  // field. Ordered descending, these queries are served by the existing
  // (userId ASC, date DESC, amount DESC) index in firestore.indexes.json.
  // Left unordered, Firestore defaults to ascending and demands a new
  // (userId, date, amount) ASC index that is not deployed. Do not remove it.
  const forUser = () => expenses.where('userId', '==', userId);

  // `date` is written as an ISO string today, but older rows hold Firestore
  // Timestamps, and a few hold a bare calendar date. Firestore orders values by
  // type before value, so a string range never matches a Timestamp (and vice
  // versa) - each window therefore has to be asked for both, or whole accounts
  // silently total zero.
  //
  // String lower bounds are the bare calendar date: "2026-07-01" sorts *before*
  // "2026-07-01T00:00:00.000Z", so a full-timestamp floor would drop date-only
  // rows landing on the 1st. Upper bounds already end at T23:59:59.999Z, which
  // is after every representation of that day.
  const stringRange = (start: string, end: string) =>
    forUser()
      .where('date', '>=', start.slice(0, 10))
      .where('date', '<=', end)
      .orderBy('date', 'desc');

  const timestampRange = (start: string, end: string) =>
    forUser()
      .where('date', '>=', new Date(start))
      .where('date', '<=', new Date(end))
      .orderBy('date', 'desc');

  /** Sum (and optionally count) one window across both `date` representations. */
  const windowTotal = async (start: string, end: string, withCount = false) => {
    const spec: Record<string, AggregateField<number>> = {
      total: AggregateField.sum('amount'),
    };
    if (withCount) {
      spec.count = AggregateField.count();
    }

    const [asString, asTimestamp] = await Promise.all([
      stringRange(start, end).aggregate(spec).get(),
      timestampRange(start, end).aggregate(spec).get(),
    ]);

    return {
      total: toFiniteNumber(asString.data().total) + toFiniteNumber(asTimestamp.data().total),
      count: toFiniteNumber(asString.data().count) + toFiniteNumber(asTimestamp.data().count),
    };
  };

  const [thisMonth, lastMonth, lastMonthFull, recentSix, olderSix] = await Promise.all([
    windowTotal(range.monthStart, range.monthToDateEnd, true),
    windowTotal(range.lastMonthStart, range.lastMonthToDateEnd),
    windowTotal(range.lastMonthStart, range.lastMonthFullEnd),
    windowTotal(range.sixMonthStart, range.sixMonthEnd),
    windowTotal(range.twelveMonthStart, range.twelveMonthEnd),
  ]);

  const totalThisMonth = roundMoney(thisMonth.total);
  const totalLastMonth = roundMoney(lastMonth.total);
  const avgMonthly6 = roundMoney(recentSix.total / TREND_MONTHS);
  const avgMonthlyPrev6 = roundMoney(olderSix.total / TREND_MONTHS);

  return {
    totalThisMonth,
    countThisMonth: thisMonth.count,
    totalLastMonth,
    totalLastMonthFull: roundMoney(lastMonthFull.total),
    avgMonthly6,
    avgMonthlyPrev6,
    monthOverMonthChangePct: percentChange(totalThisMonth, totalLastMonth),
    avgChangePct: percentChange(avgMonthly6, avgMonthlyPrev6),
    range,
  };
}

/**
 * Get dashboard summary data for authenticated user
 * 
 * @description Fetches recent expenses, budgets, notifications and spending
 * metrics in parallel. Results are cached in distributed cache for 10 minutes
 * to reduce database load.
 *
 * The `expenses` array is a capped recent-activity feed for the transactions
 * panel. Money totals belong in `metrics`, which is aggregated across the whole
 * expense history - deriving them from the capped array undercounts anyone with
 * more than {@link MAX_DASHBOARD_EXPENSES} transactions and pins the six-month
 * comparison to a permanent 0%.
 *
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Dashboard payload with expenses, budgets, notifications and metrics
 *
 * @example
 * GET /api/dashboard
 * Response: { success: true, data: { expenses: [...], budgets: [...], notifications: [...], metrics: {...} } }
 */
export const getDashboard = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    const cacheKey = buildDashboardCacheKey(userId);
    
    // Try distributed cache first
    const cached = await cache.getAsync<DashboardPayload>(cacheKey);
    if (cached) {
      res.json({ success: true, data: cached });
      return;
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Fetch all dashboard data in parallel for optimal performance
    const [expensesResult, budgetsResult, notificationsResult, metricsResult] =
      await Promise.allSettled([
        db
          .collection('expenses')
          .where('userId', '==', userId)
          .orderBy('date', 'desc')
          .limit(MAX_DASHBOARD_EXPENSES)
          .get(),
        db
          .collection('budgets')
          .where('userId', '==', userId)
          .limit(MAX_DASHBOARD_BUDGETS)
          .get(),
        db
          .collection('notifications')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(MAX_DASHBOARD_NOTIFICATIONS)
          .get(),
        computeSpendingMetrics(userId),
      ]);

    let expenses: Array<{ id: string; [key: string]: unknown }> = [];
    if (expensesResult.status === 'fulfilled') {
      expenses = expensesResult.value.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      logger.warn('Failed to fetch dashboard expenses', { userId, error: expensesResult.reason?.message });
    }

    let budgets: Array<{ id: string; [key: string]: unknown }> = [];
    if (budgetsResult.status === 'fulfilled') {
      budgets = budgetsResult.value.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      logger.warn('Failed to fetch dashboard budgets', { userId, error: budgetsResult.reason?.message });
    }

    let notifications: Array<{ id: string; [key: string]: unknown }> = [];
    if (notificationsResult.status === 'fulfilled') {
      notifications = notificationsResult.value.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      logger.warn('Failed to fetch dashboard notifications', { userId, error: notificationsResult.reason?.message });
    }

    let metrics: DashboardSpendingMetrics | null = null;
    if (metricsResult.status === 'fulfilled') {
      metrics = metricsResult.value;
    } else {
      // Stay null rather than zeroed: a zero total is indistinguishable from a
      // real "spent nothing" and would be rendered as fact.
      logger.warn('Failed to aggregate dashboard spending metrics', {
        userId,
        error: metricsResult.reason?.message,
      });
    }

    const payload: DashboardPayload = { expenses, budgets, notifications, metrics };

    // Cache in distributed cache for shared access across serverless instances
    // Fire-and-forget to not block the response on cache write failures.
    // A payload with failed metrics is not cached - a transient aggregation
    // failure should not be pinned in front of the user for the full TTL.
    if (metrics) {
      cache.setAsync(cacheKey, payload, CACHE_TTL.DASHBOARD).catch((err) => {
        logger.warn('Failed to cache dashboard data', {
          error: err instanceof Error ? err.message : 'Unknown error',
          userId
        });
      });
    }

    res.json({ success: true, data: payload });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Dashboard endpoint error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to load dashboard data', 500, false));
  }
};

/**
 * Invalidate dashboard cache for a user
 * 
 * Called when related data (expenses, budgets, notifications) changes.
 * 
 * @param userId - User ID whose dashboard cache should be invalidated
 */
export const invalidateDashboardCache = async (userId: string): Promise<void> => {
  try {
    await cache.delAsync(buildDashboardCacheKey(userId));
    logger.debug('Dashboard cache invalidated', { userId });
  } catch (error) {
    logger.error('Failed to invalidate dashboard cache', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId 
    });
  }
};

/**
 * Assembles the figures an AI summary is allowed to talk about.
 *
 * Deliberately returns aggregates, never raw transactions: the model summarizes
 * numbers this backend already computed rather than doing arithmetic of its
 * own, so a written insight cannot contradict the dashboard rendered beside it.
 * Returns null when there is nothing worth summarizing.
 */
export async function buildSpendingFacts(
  userId: string,
  now: Date = new Date()
): Promise<{
  currency: string;
  totalThisMonth: number;
  totalLastMonth: number;
  avgMonthly6: number;
  elapsedDays: number;
  topCategories: Array<{ category: string; total: number }>;
  budgets: Array<{ name: string; limit: number; spent: number }>;
} | null> {
  if (!db) {
    throw new AppError('Database not initialized', 500, false);
  }

  const metrics = await computeSpendingMetrics(userId, now);
  if (!metrics || metrics.countThisMonth === 0) {
    return null;
  }

  const range = buildMetricWindows(now);

  // Category totals over the current month, both `date` representations.
  const categoryTotals = new Map<string, number>();
  const collect = (snapshot: FirebaseFirestore.QuerySnapshot): void => {
    snapshot.forEach((doc) => {
      const data = doc.data() as { category?: string; amount?: number };
      const category = (data.category || 'other').toLowerCase();
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + (Number(data.amount) || 0));
    });
  };

  const expenses = db.collection('expenses');
  const [asStrings, asTimestamps] = await Promise.all([
    expenses
      .where('userId', '==', userId)
      .where('date', '>=', range.monthStart.slice(0, 10))
      .where('date', '<=', range.monthToDateEnd)
      .orderBy('date', 'desc')
      .get(),
    expenses
      .where('userId', '==', userId)
      .where('date', '>=', new Date(range.monthStart))
      .where('date', '<=', new Date(range.monthToDateEnd))
      .orderBy('date', 'desc')
      .get(),
  ]);
  collect(asStrings);
  collect(asTimestamps);

  const topCategories = Array.from(categoryTotals.entries())
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const budgetsSnapshot = await db.collection('budgets').where('userId', '==', userId).limit(20).get();
  const budgets = budgetsSnapshot.docs.map((doc) => {
    const data = doc.data() as { name?: string; amount?: number; category?: string };
    const category = (data.category || '').toLowerCase();
    return {
      name: String(data.name || category || 'Budget'),
      limit: Number(data.amount) || 0,
      spent: Math.round((categoryTotals.get(category) || 0) * 100) / 100,
    };
  });

  const userDoc = await db.collection('users').doc(userId).get();
  const currency = (userDoc.data()?.settings?.currency as string) || 'USD';

  return {
    currency,
    totalThisMonth: metrics.totalThisMonth,
    totalLastMonth: metrics.totalLastMonth,
    avgMonthly6: metrics.avgMonthly6,
    elapsedDays: metrics.range.elapsedDays,
    topCategories,
    budgets,
  };
}
