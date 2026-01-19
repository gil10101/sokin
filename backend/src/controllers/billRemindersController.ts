/**
 * Bill Reminders Controller
 * 
 * Handles CRUD operations for bill reminders with proper authorization,
 * caching, and error handling.
 * 
 * @module controllers/billRemindersController
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache, { CACHE_TTL } from '../utils/cache';
import { normalizeDateFields, normalizeDateValue } from '../utils/firestore';

interface BillReminder {
  id?: string;
  userId: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  category: string;
  description?: string;
  isPaid: boolean;
  paidDate?: string;
  reminderDays: number[];
  autoPayEnabled: boolean;
  linkedAccount?: string;
  createdAt: string;
  updatedAt?: string;
}

const normalizeBillReminder = (bill: BillReminder): BillReminder => normalizeDateFields(
  bill,
  ['dueDate', 'paidDate', 'createdAt', 'updatedAt']
);

/**
 * Build cache key for bill reminders list
 */
function buildBillsCacheKey(userId: string): string {
  return `bills:${userId}:list`;
}

/**
 * Build cache key for single bill reminder
 */
function buildBillCacheKey(billId: string): string {
  return `bill:${billId}`;
}

/**
 * Get user's bill reminders
 */
export const getUserBillReminders = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const cacheKey = buildBillsCacheKey(userId);
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: BillReminder[] }>(cacheKey);
    if (cachedResult) {
      res.json(cachedResult);
      return;
    }

    const billsRef = db.collection('billReminders');
    const snapshot = await billsRef.where('userId', '==', userId).get();
    
    const bills = snapshot.docs.map(doc => normalizeBillReminder({
      id: doc.id,
      ...doc.data()
    } as BillReminder));

    const result = { success: true, data: bills };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching bill reminders', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch bill reminders', 500, false));
  }
};

/**
 * Get a specific bill reminder by ID
 */
export const getBillReminderById = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { billId } = req.params;
    
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const cacheKey = buildBillCacheKey(billId);
    
    // Try distributed cache first
    const cachedBill = await cache.getAsync<{ success: boolean; data: BillReminder }>(cacheKey);
    if (cachedBill) {
      // Verify ownership from cached data
      if (cachedBill.data.userId !== userId) {
        throw new AppError('Forbidden: Access denied', 403, true);
      }
      res.json(cachedBill);
      return;
    }

    const billRef = db.collection('billReminders').doc(billId);
    const billDoc = await billRef.get();

    if (!billDoc.exists) {
      throw new AppError('Bill reminder not found', 404, true);
    }

    const billData = billDoc.data() as BillReminder;
    
    if (billData.userId !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    const bill = normalizeBillReminder({ id: billDoc.id, ...billData });
    const result = { success: true, data: bill };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.SINGLE_ITEM);

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching bill reminder', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      billId: req.params.billId,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch bill reminder', 500, false));
  }
};

/**
 * Create new bill reminder
 */
export const createBillReminder = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Validate required fields
    const { name, amount, dueDate, frequency, category, description, reminderDays, autoPayEnabled, linkedAccount } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Name is required and must be a non-empty string', 400, true);
    }
    if (name.length > 100) {
      throw new AppError('Name cannot exceed 100 characters', 400, true);
    }
    
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new AppError('Amount must be a positive number', 400, true);
    }
    
    if (!dueDate || typeof dueDate !== 'string') {
      throw new AppError('Due date is required', 400, true);
    }
    // Validate ISO date format
    if (isNaN(Date.parse(dueDate))) {
      throw new AppError('Due date must be a valid date', 400, true);
    }
    const normalizedDueDate = normalizeDateValue(dueDate);
    if (!normalizedDueDate || typeof normalizedDueDate !== 'string') {
      throw new AppError('Due date must be a valid ISO date', 400, true);
    }
    
    const validFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly', 'one-time'];
    if (!frequency || !validFrequencies.includes(frequency)) {
      throw new AppError(`Frequency must be one of: ${validFrequencies.join(', ')}`, 400, true);
    }
    
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      throw new AppError('Category is required', 400, true);
    }
    
    // Validate reminderDays if provided
    const validReminderDays = reminderDays || [7, 3, 1];
    if (!Array.isArray(validReminderDays) || validReminderDays.some((d: unknown) => typeof d !== 'number' || d < 0 || d > 365)) {
      throw new AppError('Reminder days must be an array of numbers between 0 and 365', 400, true);
    }
    
    // Validate autoPayEnabled if provided
    if (autoPayEnabled !== undefined && typeof autoPayEnabled !== 'boolean') {
      throw new AppError('Auto pay enabled must be a boolean', 400, true);
    }

    const billData: Omit<BillReminder, 'id'> = {
      userId,
      name: name.trim(),
      amount: numericAmount,
      dueDate: normalizedDueDate,
      frequency,
      category: category.trim(),
      description: description?.trim() || undefined,
      isPaid: false,
      reminderDays: validReminderDays,
      autoPayEnabled: autoPayEnabled || false,
      linkedAccount: linkedAccount?.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('billReminders').add(billData);
    const newBill = { id: docRef.id, ...billData };

    // Invalidate bills list cache
    await cache.invalidatePatternAsync(`bills:${userId}:*`);

    res.status(201).json({
      success: true,
      data: normalizeBillReminder(newBill),
      message: 'Bill reminder created successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error creating bill reminder', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to create bill reminder', 500, false));
  }
};

/**
 * Mark bill as paid
 */
export const markBillAsPaid = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { billId } = req.params;
    const { paidDate } = req.body;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const billRef = db.collection('billReminders').doc(billId);
    const billDoc = await billRef.get();

    if (!billDoc.exists) {
      throw new AppError('Bill reminder not found', 404, true);
    }

    const billData = billDoc.data() as BillReminder;
    
    if (billData.userId !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    const normalizedPaidDate = paidDate ? normalizeDateValue(paidDate) : new Date().toISOString();
    if (paidDate !== undefined && normalizedPaidDate === undefined) {
      throw new AppError('Paid date must be a valid ISO date', 400, true);
    }

    await billRef.update({
      isPaid: true,
      paidDate: normalizedPaidDate,
      updatedAt: new Date().toISOString()
    });

    // Invalidate caches
    await Promise.all([
      cache.invalidatePatternAsync(`bills:${userId}:*`),
      cache.delAsync(buildBillCacheKey(billId))
    ]);

    res.json({ success: true, message: 'Bill marked as paid successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error marking bill as paid', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      billId: req.params.billId, 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to mark bill as paid', 500, false));
  }
};

/**
 * Update bill reminder
 */
export const updateBillReminder = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { billId } = req.params;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const billRef = db.collection('billReminders').doc(billId);
    const billDoc = await billRef.get();

    if (!billDoc.exists) {
      throw new AppError('Bill reminder not found', 404, true);
    }

    const billData = billDoc.data() as BillReminder;
    
    if (billData.userId !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    // Whitelist only allowed updatable fields to prevent protected field modification
    const updateData: Partial<BillReminder> & { updatedAt: string } = {
      updatedAt: new Date().toISOString()
    };

    // Validate and assign fields from request body
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || req.body.name.trim().length === 0) {
        throw new AppError('Name must be a non-empty string', 400, true);
      }
      if (req.body.name.length > 100) {
        throw new AppError('Name cannot exceed 100 characters', 400, true);
      }
      updateData.name = req.body.name.trim();
    }
    
    if (req.body.amount !== undefined) {
      const numericAmount = Number(req.body.amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new AppError('Amount must be a positive number', 400, true);
      }
      updateData.amount = numericAmount;
    }
    
    if (req.body.dueDate !== undefined) {
      if (typeof req.body.dueDate !== 'string' || isNaN(Date.parse(req.body.dueDate))) {
        throw new AppError('Due date must be a valid date', 400, true);
      }
      const normalizedDue = normalizeDateValue(req.body.dueDate);
      if (!normalizedDue || typeof normalizedDue !== 'string') {
        throw new AppError('Due date must be a valid ISO date', 400, true);
      }
      updateData.dueDate = normalizedDue;
    }
    
    if (req.body.frequency !== undefined) {
      const validFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly', 'one-time'];
      if (!validFrequencies.includes(req.body.frequency)) {
        throw new AppError(`Frequency must be one of: ${validFrequencies.join(', ')}`, 400, true);
      }
      updateData.frequency = req.body.frequency;
    }
    
    if (req.body.category !== undefined) {
      if (typeof req.body.category !== 'string' || req.body.category.trim().length === 0) {
        throw new AppError('Category must be a non-empty string', 400, true);
      }
      updateData.category = req.body.category.trim();
    }
    
    if (req.body.description !== undefined) {
      updateData.description = req.body.description?.trim() || undefined;
    }
    
    if (req.body.reminderDays !== undefined) {
      if (!Array.isArray(req.body.reminderDays) || req.body.reminderDays.some((d: unknown) => typeof d !== 'number' || d < 0 || d > 365)) {
        throw new AppError('Reminder days must be an array of numbers between 0 and 365', 400, true);
      }
      updateData.reminderDays = req.body.reminderDays;
    }
    
    if (req.body.autoPayEnabled !== undefined) {
      if (typeof req.body.autoPayEnabled !== 'boolean') {
        throw new AppError('Auto pay enabled must be a boolean', 400, true);
      }
      updateData.autoPayEnabled = req.body.autoPayEnabled;
    }
    
    if (req.body.linkedAccount !== undefined) {
      updateData.linkedAccount = req.body.linkedAccount?.trim() || undefined;
    }

    await billRef.update(updateData);

    // Invalidate caches
    await Promise.all([
      cache.invalidatePatternAsync(`bills:${userId}:*`),
      cache.delAsync(buildBillCacheKey(billId))
    ]);

    res.json({ success: true, message: 'Bill reminder updated successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error updating bill reminder', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      billId: req.params.billId, 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to update bill reminder', 500, false));
  }
};

/**
 * Delete bill reminder
 */
export const deleteBillReminder = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { billId } = req.params;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const billRef = db.collection('billReminders').doc(billId);
    const billDoc = await billRef.get();

    if (!billDoc.exists) {
      throw new AppError('Bill reminder not found', 404, true);
    }

    const billData = billDoc.data() as BillReminder;
    
    if (billData.userId !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    await billRef.delete();

    // Invalidate caches
    await Promise.all([
      cache.invalidatePatternAsync(`bills:${userId}:*`),
      cache.delAsync(buildBillCacheKey(billId))
    ]);

    res.json({ success: true, message: 'Bill reminder deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error deleting bill reminder', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      billId: req.params.billId, 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to delete bill reminder', 500, false));
  }
};
