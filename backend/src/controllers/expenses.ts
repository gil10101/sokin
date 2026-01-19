import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache, { CACHE_TTL } from '../utils/cache';
import { Expense, PaginationMeta } from '../models/types';
import { normalizeDateFields } from '../utils/firestore';

const DEFAULT_PAGE_SIZE = 50;

const MAX_PAGE_SIZE = 100;

interface ExpenseUpdateFields {
  name?: string;
  amount?: number;
  date?: string;
  category?: string;
  description?: string;
  tags?: string[];
  receiptImageUrl?: string;
  receiptData?: {
    merchant?: string;
    confidence?: number;
    items?: string[];
    rawText?: string;
  } | null;
  updatedAt: string;
  [key: string]: unknown; // Index signature for Firestore compatibility
}

const normalizeExpense = (expense: Expense): Expense => normalizeDateFields(
  expense,
  ['date', 'createdAt', 'updatedAt']
);

const normalizeIsoDate = (value: unknown, fieldName: string): string => {
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName} date`, 400, true);
  }
  return date.toISOString();
};

function buildExpensesCacheKey(
  userId: string,
  params: {
    limit: number;
    cursor?: string;
    sortBy: string;
    sortOrder: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  }
): string {
  return `expenses:${userId}:${params.limit}:${params.cursor || 'start'}:${params.sortBy}:${params.sortOrder}:${params.category || ''}:${params.startDate || ''}:${params.endDate || ''}`;
}

function buildExpenseCacheKey(expenseId: string): string {
  return `expense:${expenseId}`;
}

export const getAllExpenses = async (
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
    
    // Pagination
    const limit = Math.min(
      Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const cursor = req.query.cursor as string | undefined;
    const sortOrderParam = req.query.sortOrder as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'date';
    
    // Validate sort order
    const validSortOrders = ['asc', 'desc'];
    if (sortOrderParam && !validSortOrders.includes(sortOrderParam)) {
      throw new AppError(`Invalid sortOrder. Allowed: ${validSortOrders.join(', ')}`, 400, true);
    }
    const sortOrder = (sortOrderParam as 'asc' | 'desc') || 'desc';
    
    // Validate sort field
    const allowedSortFields = ['date', 'createdAt', 'amount', 'name', 'category'];
    if (!allowedSortFields.includes(sortBy)) {
      throw new AppError(`Invalid sortBy field. Allowed: ${allowedSortFields.join(', ')}`, 400, true);
    }
    
    // Filters
    const category = req.query.category as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    
    const cacheKey = buildExpensesCacheKey(userId, {
      limit, cursor, sortBy, sortOrder, category, startDate, endDate
    });
    
    const cachedResult = await cache.getAsync<{ success: boolean; data: Expense[]; pagination: PaginationMeta }>(cacheKey);
    if (cachedResult) {
      res.status(200).json(cachedResult);
      return;
    }

    let query = db.collection('expenses')
      .where('userId', '==', userId);
    
    if (category) {
      query = query.where('category', '==', category);
    }
    
    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }
    
    // Firestore requires orderBy on inequality field.
    if ((startDate || endDate) && sortBy !== 'date') {
      query = query.orderBy('date', sortOrder).orderBy(sortBy, sortOrder);
    } else {
    query = query.orderBy(sortBy, sortOrder);
    }
    
    // Cursor with ownership check
    if (cursor) {
      try {
        const cursorDoc = await db.collection('expenses').doc(cursor).get();
        // Ensure cursor belongs to user
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
    
    // Fetch one extra for hasMore
    const expensesSnapshot = await query.limit(limit + 1).get();
    
    const allDocs = expensesSnapshot.docs;
    const hasMore = allDocs.length > limit;
    const docs = hasMore ? allDocs.slice(0, limit) : allDocs;
    
    const expenses = docs.map(doc => normalizeExpense({
      id: doc.id,
      ...doc.data()
    } as Expense));

    // Determine next cursor
    const nextCursor = hasMore && docs.length > 0 
      ? docs[docs.length - 1].id 
      : null;

    const pagination: PaginationMeta = {
      count: expenses.length,
      limit,
      nextCursor,
      hasMore
    };

    const result = { success: true, data: expenses, pagination };
    
    // Cache results in distributed cache
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in getAllExpenses', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch expenses', 500, false));
  }
};

export const getExpenseById = async (
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

    const expenseId = req.params.id;
    const cacheKey = buildExpenseCacheKey(expenseId);
    
    // Cache
    const cachedExpense = await cache.getAsync<{ success: boolean; data: Expense }>(cacheKey);
    if (cachedExpense) {
      // Check owner
      if (cachedExpense.data.userId !== req.user.uid) {
        throw new AppError('Forbidden: You do not have access to this expense', 403, true);
      }
      res.status(200).json(cachedExpense);
      return;
    }
    
    const expenseDoc = await db.collection('expenses').doc(expenseId).get();

    if (!expenseDoc.exists) {
      throw new AppError('Expense not found', 404, true);
    }

    const expenseData = expenseDoc.data();
    
    if (!expenseData) {
      throw new AppError('Expense data is missing', 404, true);
    }
    
    // Check owner
    if (expenseData.userId !== req.user.uid) {
      throw new AppError('Forbidden: You do not have access to this expense', 403, true);
    }

    const expense = normalizeExpense({
      id: expenseDoc.id,
      ...expenseData
    } as Expense);
    
    const result = { success: true, data: expense };
    
    await cache.setAsync(cacheKey, result, CACHE_TTL.SINGLE_ITEM);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in getExpenseById', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      expenseId: req.params.id,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch expense', 500, false));
  }
};

export const createExpense = async (
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

    const { name, amount, date, category, description, tags, receiptImageUrl, receiptData } = req.body;

    // Extra validation
    if (!name || amount === undefined || !date || !category) {
      throw new AppError('Missing required fields: name, amount, date, and category are required', 400, true);
    }
    const normalizedDate = normalizeIsoDate(date, 'expense');

    const expenseData: Omit<Expense, 'id'> = {
      userId: req.user.uid,
      name,
      amount: Number(amount),
      date: normalizedDate,
      category,
      description: description || '',
      tags: tags || [],
      createdAt: new Date().toISOString(),
    };

    // Optional receipt fields
    const fullExpenseData = {
      ...expenseData,
      ...(receiptImageUrl && { receiptImageUrl }),
      ...(receiptData && { receiptData })
    };

    const expenseRef = await db.collection('expenses').add(fullExpenseData);
    
    // Invalidate cached pages
    await cache.invalidatePatternAsync(`expenses:${req.user.uid}:*`);
    
    res.status(201).json({ 
      success: true,
      data: normalizeExpense({
        id: expenseRef.id,
        ...fullExpenseData
      } as Expense),
      message: 'Expense created successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in createExpense', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid 
    });
    next(new AppError('Failed to create expense', 500, false));
  }
};

export const updateExpense = async (
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

    const expenseId = req.params.id;
    const expenseDoc = await db.collection('expenses').doc(expenseId).get();

    if (!expenseDoc.exists) {
      throw new AppError('Expense not found', 404, true);
    }

    const expenseData = expenseDoc.data() as Expense;
    
    if (!expenseData) {
      throw new AppError('Expense data is missing', 404, true);
    }
    
    // Check owner
    if (expenseData.userId !== req.user.uid) {
      throw new AppError('Forbidden: You do not have access to this expense', 403, true);
    }

    const { name, amount, date, category, description, tags, receiptImageUrl, receiptData } = req.body;
    
    // Update fields
    const updateData: ExpenseUpdateFields = {
      updatedAt: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (date !== undefined) updateData.date = normalizeIsoDate(date, 'expense');
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (receiptImageUrl !== undefined) updateData.receiptImageUrl = receiptImageUrl;
    if (receiptData !== undefined) updateData.receiptData = receiptData;

    await db.collection('expenses').doc(expenseId).update(updateData);
    
    // Invalidate cache
    await Promise.all([
      cache.invalidatePatternAsync(`expenses:${req.user.uid}:*`),
      cache.delAsync(buildExpenseCacheKey(expenseId))
    ]);
    
    res.status(200).json({ 
      success: true,
      data: normalizeExpense({
        id: expenseId,
        ...expenseData,
        ...updateData
      } as Expense),
      message: 'Expense updated successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in updateExpense', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      expenseId: req.params.id,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to update expense', 500, false));
  }
};

export const deleteExpense = async (
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

    const expenseId = req.params.id;
    const expenseDoc = await db.collection('expenses').doc(expenseId).get();

    if (!expenseDoc.exists) {
      throw new AppError('Expense not found', 404, true);
    }

    const expenseData = expenseDoc.data();
    
    if (!expenseData) {
      throw new AppError('Expense data is missing', 404, true);
    }
    
    // Check owner
    if (expenseData.userId !== req.user.uid) {
      throw new AppError('Forbidden: You do not have access to this expense', 403, true);
    }

    await db.collection('expenses').doc(expenseId).delete();
    
    // Invalidate cache
    await Promise.all([
      cache.invalidatePatternAsync(`expenses:${req.user.uid}:*`),
      cache.delAsync(buildExpenseCacheKey(expenseId))
    ]);
    
    res.status(200).json({ 
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in deleteExpense', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      expenseId: req.params.id,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to delete expense', 500, false));
  }
};

export const getExpenseAnalytics = async (
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
    const timeframe = (req.query.timeframe as string) || '6months';
    
    // Validate timeframe
    const validTimeframes = ['3months', '6months', '12months'];
    if (!validTimeframes.includes(timeframe)) {
      throw new AppError(`Invalid timeframe. Allowed: ${validTimeframes.join(', ')}`, 400, true);
    }

    const cacheKey = `expenses:analytics:${userId}:${timeframe}`;

    const cachedResult = await cache.getAsync<{
      success: boolean;
      data: {
        monthlyData: Array<{ month: string; amount: number; count: number }>;
        categoryData: Array<{ category: string; amount: number; count: number; percentage: number }>;
        summary: {
          totalExpense: number;
          monthlyAverage: number;
          totalTransactions: number;
          highestCategory: string;
          highestCategoryAmount: number;
        };
        timeframe: string;
        dateRange: { start: string; end: string };
      };
    }>(cacheKey);
    
    if (cachedResult) {
      res.status(200).json(cachedResult);
      return;
    }

    // Date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case '3months':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '12months':
        startDate.setMonth(endDate.getMonth() - 12);
        break;
    }
    
    // Set to start of day and end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    // Fetch all expenses in the date range
    const expensesSnapshot = await db.collection('expenses')
      .where('userId', '==', userId)
      .where('date', '>=', startDateStr)
      .where('date', '<=', endDateStr)
      .orderBy('date', 'desc')
      .get();

    const expenses = expensesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];

    // Calculate monthly data
    const monthlyMap = new Map<string, { amount: number; count: number; sortKey: string }>();
    
    expenses.forEach(expense => {
      const expenseDate = new Date(expense.date);
      const monthKey = expenseDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const sortKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
      
      const existing = monthlyMap.get(monthKey);
      if (existing) {
        existing.amount += expense.amount;
        existing.count += 1;
      } else {
        monthlyMap.set(monthKey, {
          amount: expense.amount,
          count: 1,
          sortKey
        });
      }
    });
    
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, amount: data.amount, count: data.count, sortKey: data.sortKey }))
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      .map(({ sortKey: _sortKey, ...rest }) => rest);

    // Calculate category data
    const categoryMap = new Map<string, { amount: number; count: number }>();
    let totalExpense = 0;
    
    expenses.forEach(expense => {
      const existing = categoryMap.get(expense.category) || { amount: 0, count: 0 };
      categoryMap.set(expense.category, {
        amount: existing.amount + expense.amount,
        count: existing.count + 1
      });
      totalExpense += expense.amount;
    });
    
    const categoryData = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        count: data.count,
        percentage: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate summary statistics
    const totalTransactions = expenses.length;
    const numberOfMonths = monthlyData.length || 1;
    const monthlyAverage = totalExpense / numberOfMonths;
    
    const highestCategory = categoryData.length > 0 
      ? categoryData[0].category 
      : 'N/A';
    const highestCategoryAmount = categoryData.length > 0 
      ? categoryData[0].amount 
      : 0;

    const result = {
      success: true,
      data: {
        monthlyData,
        categoryData,
        summary: {
          totalExpense,
          monthlyAverage: Math.round(monthlyAverage * 100) / 100,
          totalTransactions,
          highestCategory,
          highestCategoryAmount
        },
        timeframe,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      }
    };
    
    // Cache results in distributed cache (2 minutes cache for analytics)
    await cache.setAsync(cacheKey, result, 2 * 60);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error in getExpenseAnalytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid,
      timeframe: req.query.timeframe
    });
    next(new AppError('Failed to fetch expense analytics', 500, false));
  }
};
