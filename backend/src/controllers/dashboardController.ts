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

/** Dashboard response payload type */
interface DashboardPayload {
  expenses: Array<{ id: string; [key: string]: unknown }>;
  budgets: Array<{ id: string; [key: string]: unknown }>;
  notifications: Array<{ id: string; [key: string]: unknown }>;
}

/**
 * Build cache key for dashboard
 */
function buildDashboardCacheKey(userId: string): string {
  return `dashboard:${userId}`;
}

/**
 * Get dashboard summary data for authenticated user
 * 
 * @description Fetches recent expenses, budgets, and notifications in parallel.
 * Results are cached in distributed cache for 10 minutes to reduce database load.
 * 
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Dashboard payload with expenses, budgets, and notifications
 * 
 * @example
 * GET /api/dashboard
 * Response: { success: true, data: { expenses: [...], budgets: [...], notifications: [...] } }
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
    const [expensesSnap, budgetsSnap, notificationsSnap] = await Promise.all([
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
    ]);

    const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const budgets = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const notifications = notificationsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const payload: DashboardPayload = { expenses, budgets, notifications };
    
    // Cache in distributed cache for shared access across serverless instances
    // Fire-and-forget to not block the response on cache write failures
    cache.setAsync(cacheKey, payload, CACHE_TTL.DASHBOARD).catch((err) => {
      logger.warn('Failed to cache dashboard data', { 
        error: err instanceof Error ? err.message : 'Unknown error',
        userId 
      });
    });

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
