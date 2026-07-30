/**
 * Budgets Controller
 * 
 * Handles CRUD operations for user budgets with caching,
 * authorization, and proper error handling. Supports cursor-based
 * pagination for efficient data retrieval.
 * 
 * @module controllers/budgets
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache, { CACHE_TTL } from '../utils/cache';
import { Budget, PaginationMeta } from '../models/types';
import { normalizeDateFields, normalizeDateValue } from '../utils/firestore';
import { invalidateDashboardCache } from './dashboardController';

/** Default page size for pagination */
const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size for pagination */
const MAX_PAGE_SIZE = 100;

/** Fields that can be updated on a budget */
type BudgetUpdateFields = {
  name?: string;
  category?: string;
  amount?: number;
  period?: Budget['period'];
  categories?: string[];
  startDate?: string;
  endDate?: string | null;
  updatedAt: string;
  [key: string]: unknown; // Allow index signature for Firestore compatibility
}

const normalizeBudget = (budget: Budget): Budget => {
  const category = budget.category || budget.categories?.[0] || budget.name;
  const categories = budget.categories && budget.categories.length > 0
    ? budget.categories
    : category
      ? [category]
      : [];

  return normalizeDateFields({
    ...budget,
    category,
    categories
  }, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
};

/**
 * Build cache key for budget queries
 */
function buildBudgetsCacheKey(
  userId: string,
  params: {
    limit: number;
    cursor?: string;
    sortBy: string;
    sortOrder: string;
    period?: string;
    activeOnly: boolean;
  }
): string {
  return `budgets:${userId}:${params.limit}:${params.cursor || 'start'}:${params.sortBy}:${params.sortOrder}:${params.period || ''}:${params.activeOnly}`;
}

/**
 * Build cache key for single budget
 */
function buildBudgetCacheKey(budgetId: string): string {
  return `budget:${budgetId}`;
}

/**
 * Get all budgets for authenticated user with cursor-based pagination
 * 
 * @description Fetches budgets with pagination support for efficient data retrieval.
 * Uses cursor-based pagination to handle large datasets without offset issues.
 * Results are cached in distributed cache for 30 seconds.
 * 
 * @param req - Express request with authenticated user
 * @param req.query.limit - Number of items to return (1-100, default: 50)
 * @param req.query.cursor - Document ID to start after (for pagination)
 * @param req.query.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
 * @param req.query.sortBy - Field to sort by: 'createdAt', 'amount', 'name', 'startDate' (default: 'createdAt')
 * @param req.query.period - Filter by period type (optional)
 * @param req.query.activeOnly - Filter active budgets only (default: false)
 * @param res - Express response
 * @param next - Express next function for error propagation
 * 
 * @example
 * GET /api/budgets?limit=20&activeOnly=true
 * Response: { 
 *   data: [{ id, name, amount, period, ... }],
 *   pagination: { count: 20, limit: 20, nextCursor: 'xyz789', hasMore: true }
 * }
 */
export const getAllBudgets = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const userId = req.user.uid;
    
    // Parse pagination parameters (validated by middleware)
    const limit = Math.min(
      Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const cursor = req.query.cursor as string | undefined;
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    
    // Parse filter parameters
    const period = req.query.period as string | undefined;
    const activeOnly = String(req.query.activeOnly) === 'true';
    
    // Build cache key
    const cacheKey = buildBudgetsCacheKey(userId, {
      limit, cursor, sortBy, sortOrder, period, activeOnly
    });
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: Budget[]; pagination: PaginationMeta }>(cacheKey);
    if (cachedResult) {
      res.status(200).json(cachedResult);
      return;
    }

    // Build query with filters
    let query = db.collection('budgets')
      .where('userId', '==', userId);
    
    // Apply period filter
    if (period) {
      query = query.where('period', '==', period);
    }
    
    // Apply active filter
    if (activeOnly) {
      query = query.where('isActive', '==', true);
    }
    
    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);
    
    // Apply cursor for pagination
    if (cursor) {
      try {
        const cursorDoc = await db.collection('budgets').doc(cursor).get();
        // Verify cursor document exists and belongs to the current user
        if (cursorDoc.exists && cursorDoc.data()?.userId === userId) {
          query = query.startAfter(cursorDoc);
        } else {
          throw new AppError('Invalid pagination cursor', 400, true);
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Invalid pagination cursor', 400, true);
      }
    }
    
    // Fetch one extra to determine if there are more results
    const budgetsSnapshot = await query.limit(limit + 1).get();
    
    const allDocs = budgetsSnapshot.docs;
    const hasMore = allDocs.length > limit;
    const docs = hasMore ? allDocs.slice(0, limit) : allDocs;
    
    const budgets = docs.map(doc => normalizeBudget({
      id: doc.id,
      ...doc.data()
    } as Budget));

    // Determine next cursor
    const nextCursor = hasMore && docs.length > 0 
      ? docs[docs.length - 1].id 
      : null;

    const pagination: PaginationMeta = {
      count: budgets.length,
      limit,
      nextCursor,
      hasMore
    };

    const result = { success: true, data: budgets, pagination };
    
    // Cache results in distributed cache
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in getAllBudgets', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch budgets', 500, false));
  }
};

/**
 * Get a specific budget by ID
 * 
 * @param req - Express request with budget ID in params
 * @param res - Express response
 * @param next - Express next function for error propagation
 * 
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Budget not found
 */
export const getBudgetById = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const userId = req.user.uid;
    const budgetId = req.params.id;
    const cacheKey = buildBudgetCacheKey(budgetId);
    
    // Try distributed cache first
    const cachedBudget = await cache.getAsync<{ success: boolean; data: Budget }>(cacheKey);
    if (cachedBudget) {
      // Verify ownership from cached data
      if (cachedBudget.data.userId !== userId) {
        throw new AppError('Forbidden: You do not have access to this budget', 403, true);
      }
      res.status(200).json(cachedBudget);
      return;
    }
    
    const budgetDoc = await db.collection('budgets').doc(budgetId).get();
    
    if (!budgetDoc.exists) {
      throw new AppError('Budget not found', 404, true);
    }
    
    const budgetData = budgetDoc.data() as Budget;
    
    if (!budgetData) {
      throw new AppError('Budget data is missing', 404, true);
    }
    
    // Verify ownership
    if (budgetData.userId !== userId) {
      throw new AppError('Forbidden: You do not have access to this budget', 403, true);
    }
    
    const budget = normalizeBudget({
      id: budgetDoc.id,
      ...budgetData
    });
    
    const result = { success: true, data: budget };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.SINGLE_ITEM);
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in getBudgetById', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      budgetId: req.params.id,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch budget', 500, false));
  }
};

/**
 * Create a new budget
 * 
 * @description Creates a budget and invalidates the user's budget cache.
 * 
 * @param req - Express request with budget data in body
 * @param res - Express response
 * @param next - Express next function for error propagation
 * 
 * @throws {AppError} 401 - Unauthorized
 */
export const createBudget = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const { name, category, amount, period, categories, startDate, endDate, notes } = req.body;
    const budgetName = name || category;
    
    // Validate numeric amount to prevent NaN in database
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new AppError('Amount must be a positive number', 400, true);
    }
    
    const normalizedStartDate = normalizeDateValue(startDate);
    if (!normalizedStartDate || typeof normalizedStartDate !== 'string') {
      throw new AppError('Start date must be a valid ISO date', 400, true);
    }
    const normalizedEndDate = endDate !== undefined ? normalizeDateValue(endDate) : undefined;
    if (endDate !== undefined && normalizedEndDate === undefined) {
      throw new AppError('End date must be a valid ISO date', 400, true);
    }

    const budgetData: Omit<Budget, 'id'> = {
      userId: req.user.uid,
      name: budgetName,
      amount: numericAmount,
      period,
      category,
      categories: categories || (category ? [category] : []),
      startDate: normalizedStartDate,
      endDate: normalizedEndDate || undefined,
      notes: notes ?? null,
      createdAt: new Date().toISOString(),
    };
    
    const budgetRef = await db.collection('budgets').add(budgetData);
    
    // Invalidate all cached budget pages for this user
    await cache.invalidatePatternAsync(`budgets:${req.user.uid}:*`);
    await invalidateDashboardCache(req.user!.uid);

    res.status(201).json({
      success: true,
      data: normalizeBudget({
        id: budgetRef.id,
        ...budgetData
      }),
      message: 'Budget created successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in createBudget', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid 
    });
    next(new AppError('Failed to create budget', 500, false));
  }
};

/**
 * Update an existing budget
 * 
 * @description Updates a budget and invalidates the user's budget cache.
 * 
 * @param req - Express request with budget ID in params and update data in body
 * @param res - Express response
 * @param next - Express next function for error propagation
 * 
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Budget not found
 */
export const updateBudget = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const userId = req.user.uid;
    const budgetId = req.params.id;
    
    const budgetDoc = await db.collection('budgets').doc(budgetId).get();
    
    if (!budgetDoc.exists) {
      throw new AppError('Budget not found', 404, true);
    }
    
    const budgetData = budgetDoc.data() as Budget;
    
    if (!budgetData) {
      throw new AppError('Budget data is missing', 404, true);
    }
    
    // Verify ownership
    if (budgetData.userId !== userId) {
      throw new AppError('Forbidden: You do not have access to this budget', 403, true);
    }
    
    // Build type-safe update object
    const { name, category, amount, period, categories, startDate, endDate, notes } = req.body;
    const updateData: BudgetUpdateFields = {
      updatedAt: new Date().toISOString()
    };
    
    // Validate and assign name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new AppError('Name must be a non-empty string', 400, true);
      }
      updateData.name = name.trim();
    }
    
    // Validate and assign amount
    if (amount !== undefined) {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new AppError('Amount must be a positive number', 400, true);
      }
      updateData.amount = numericAmount;
    }
    
    // Validate and assign period
    if (period !== undefined) {
      const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
      if (!validPeriods.includes(period)) {
        throw new AppError(`Period must be one of: ${validPeriods.join(', ')}`, 400, true);
      }
      updateData.period = period;
    }
    
    if (category !== undefined) {
      updateData.category = category;
      if (name === undefined) {
        updateData.name = category;
      }
    }
    if (categories !== undefined) updateData.categories = categories;
    if (startDate !== undefined) {
      const normalizedStart = normalizeDateValue(startDate);
      if (!normalizedStart || typeof normalizedStart !== 'string') {
        throw new AppError('Start date must be a valid ISO date', 400, true);
      }
      updateData.startDate = normalizedStart;
    }
    if (endDate !== undefined) {
      const normalizedEnd = normalizeDateValue(endDate);
      if (normalizedEnd === undefined) {
        throw new AppError('End date must be a valid ISO date', 400, true);
      }
      updateData.endDate = normalizedEnd;
    }
    if (notes !== undefined) updateData.notes = notes;
    
    await db.collection('budgets').doc(budgetId).update(updateData);
    
    // Invalidate caches non-blocking to not fail request on cache errors
    Promise.all([
      cache.invalidatePatternAsync(`budgets:${userId}:*`),
      cache.delAsync(buildBudgetCacheKey(budgetId))
    ]).catch((err) => {
      logger.warn('Cache invalidation failed for budget update', {
        budgetId, userId, error: err instanceof Error ? err.message : 'Unknown error'
      });
    });
    await invalidateDashboardCache(req.user!.uid);

    res.status(200).json({
      success: true,
      data: normalizeBudget({
        id: budgetId,
        ...budgetData,
        ...updateData
      } as Budget),
      message: 'Budget updated successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in updateBudget', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      budgetId: req.params.id,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to update budget', 500, false));
  }
};

/**
 * Delete a budget
 * 
 * @description Deletes a budget and invalidates the user's budget cache.
 * 
 * @param req - Express request with budget ID in params
 * @param res - Express response
 * @param next - Express next function for error propagation
 * 
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Budget not found
 */
export const deleteBudget = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const userId = req.user.uid;
    const budgetId = req.params.id;
    
    const budgetDoc = await db.collection('budgets').doc(budgetId).get();
    
    if (!budgetDoc.exists) {
      throw new AppError('Budget not found', 404, true);
    }
    
    const budgetData = budgetDoc.data() as Budget;
    
    if (!budgetData) {
      throw new AppError('Budget data is missing', 404, true);
    }
    
    // Verify ownership
    if (budgetData.userId !== userId) {
      throw new AppError('Forbidden: You do not have access to this budget', 403, true);
    }
    
    await db.collection('budgets').doc(budgetId).delete();
    
    // Invalidate caches non-blocking to not fail request on cache errors
    Promise.all([
      cache.invalidatePatternAsync(`budgets:${userId}:*`),
      cache.delAsync(buildBudgetCacheKey(budgetId))
    ]).catch((err) => {
      logger.warn('Cache invalidation failed for budget delete', {
        budgetId, userId, error: err instanceof Error ? err.message : 'Unknown error'
      });
    });
    await invalidateDashboardCache(req.user!.uid);

    res.status(200).json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in deleteBudget', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      budgetId: req.params.id,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to delete budget', 500, false));
  }
};
