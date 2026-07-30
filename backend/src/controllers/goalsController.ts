/**
 * Goals Controller
 * 
 * Handles CRUD operations for savings goals with proper authorization,
 * caching, and error handling.
 * 
 * @module controllers/goalsController
 */

import { Request, Response, NextFunction } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../config/firebase';
import { SavingsGoal, GoalContribution } from '../models/types';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache, { CACHE_TTL } from '../utils/cache';
import { normalizeDateFields } from '../utils/firestore';

/**
 * Build cache key for goals list
 */
function buildGoalsCacheKey(userId: string): string {
  return `goals:${userId}:list`;
}

/**
 * Build cache key for single goal
 */
function buildGoalCacheKey(goalId: string): string {
  return `goal:${goalId}`;
}

const normalizeGoal = (goal: SavingsGoal): SavingsGoal => {
  const normalizedContributions = goal.contributions?.map((contribution) =>
    normalizeDateFields(contribution, ['date'])
  );

  return normalizeDateFields(
    { ...goal, contributions: normalizedContributions },
    ['targetDate', 'createdAt', 'updatedAt', 'completedAt']
  );
};

/**
 * Get user's savings goals
 */
export const getUserGoals = async (
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

    const cacheKey = buildGoalsCacheKey(userId);
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: SavingsGoal[] }>(cacheKey);
    if (cachedResult) {
      res.json(cachedResult);
      return;
    }
    
    const goalsRef = db.collection('goals');
    const snapshot = await goalsRef.where('userId', '==', userId).get();
    
    const goals = snapshot.docs.map(doc => normalizeGoal({
      id: doc.id,
      ...doc.data()
    } as SavingsGoal));

    const result = { success: true, data: goals };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching goals', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch goals', 500, false));
  }
};

/**
 * Get a specific goal by ID
 */
export const getGoalById = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { goalId } = req.params;
    
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const cacheKey = buildGoalCacheKey(goalId);
    
    // Try distributed cache first
    const cachedGoal = await cache.getAsync<{ success: boolean; data: SavingsGoal }>(cacheKey);
    if (cachedGoal) {
      // Verify ownership from cached data
      if (cachedGoal.data.userId !== userId) {
        throw new AppError('Forbidden: Access denied', 403, true);
      }
      res.json(cachedGoal);
      return;
    }
    
    const goalRef = db.collection('goals').doc(goalId);
    const goalDoc = await goalRef.get();

    if (!goalDoc.exists) {
      throw new AppError('Goal not found', 404, true);
    }

    const goalData = goalDoc.data() as SavingsGoal;
    
    if (goalData.userId !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    const goal = normalizeGoal({ id: goalDoc.id, ...goalData });
    const result = { success: true, data: goal };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.SINGLE_ITEM);

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching goal', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      goalId: req.params.goalId,
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch goal', 500, false));
  }
};

/**
 * Create new savings goal
 */
export const createGoal = async (
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
    const { name, description, targetAmount, targetDate, category, priority, milestones } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Name is required and must be a non-empty string', 400, true);
    }
    if (name.length > 100) {
      throw new AppError('Name cannot exceed 100 characters', 400, true);
    }
    
    const numericTargetAmount = Number(targetAmount);
    if (!Number.isFinite(numericTargetAmount) || numericTargetAmount <= 0) {
      throw new AppError('Target amount must be a positive number', 400, true);
    }
    
    // Validate targetDate if provided
    if (targetDate) {
      if (typeof targetDate !== 'string' || isNaN(Date.parse(targetDate))) {
        throw new AppError('Target date must be a valid date', 400, true);
      }
    }
    
    // Validate priority if provided
    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      throw new AppError(`Priority must be one of: ${validPriorities.join(', ')}`, 400, true);
    }
    
    // Validate milestones if provided
    if (milestones) {
      if (!Array.isArray(milestones)) {
        throw new AppError('Milestones must be an array', 400, true);
      }
      for (const milestone of milestones) {
        if (typeof milestone.percentage !== 'number' || milestone.percentage < 0 || milestone.percentage > 100) {
          throw new AppError('Milestone percentage must be a number between 0 and 100', 400, true);
        }
        if (typeof milestone.amount !== 'number' || milestone.amount < 0) {
          throw new AppError('Milestone amount must be a non-negative number', 400, true);
        }
      }
    }

    // Create validated milestones with correct amounts based on validated targetAmount
    const validatedMilestones = milestones || [
      { percentage: 25, amount: numericTargetAmount * 0.25 },
      { percentage: 50, amount: numericTargetAmount * 0.5 },
      { percentage: 75, amount: numericTargetAmount * 0.75 },
      { percentage: 100, amount: numericTargetAmount }
    ];

    const goalData: Omit<SavingsGoal, 'id'> = {
      userId,
      name: name.trim(),
      description: description?.trim() || undefined,
      targetAmount: numericTargetAmount,
      currentAmount: 0,
      targetDate: targetDate || undefined,
      category: category?.trim() || undefined,
      priority: priority || 'medium',
      isCompleted: false,
      createdAt: new Date().toISOString(),
      milestones: validatedMilestones,
      contributions: []
    };

    const docRef = await db.collection('goals').add(goalData);
    const newGoal = normalizeGoal({ id: docRef.id, ...goalData });

    // Invalidate goals list cache
    await cache.invalidatePatternAsync(`goals:${userId}:*`);

    res.status(201).json({ success: true, data: newGoal, message: 'Goal created successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error creating goal', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to create goal', 500, false));
  }
};

/**
 * Add contribution to goal
 */
export const addContribution = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { goalId } = req.params;
    const { amount, method, source, note } = req.body;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Validate contribution amount upfront
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Contribution amount must be a positive number', 400, true);
    }

    const goalRef = db.collection('goals').doc(goalId);
    
    // Use Firestore transaction to prevent race conditions on concurrent contributions
    const result = await db.runTransaction(async (transaction) => {
      const goalDoc = await transaction.get(goalRef);

      if (!goalDoc.exists) {
        throw new AppError('Goal not found', 404, true);
      }

      const goalData = goalDoc.data() as SavingsGoal;
      
      if (goalData.userId !== userId) {
        throw new AppError('Forbidden: Access denied', 403, true);
      }

      const contribution: GoalContribution = {
        id: `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        amount,
        date: new Date().toISOString(),
        method: method || 'manual',
        source,
        note
      };

      const newCurrentAmount = goalData.currentAmount + amount;
      const isCompleted = newCurrentAmount >= goalData.targetAmount;

      // Update milestones
      const updatedMilestones = goalData.milestones?.map(milestone => ({
        ...milestone,
        achievedAt: newCurrentAmount >= milestone.amount && !milestone.achievedAt 
          ? new Date().toISOString() 
          : milestone.achievedAt
      }));

      // Use atomic operations within transaction
      transaction.update(goalRef, {
        currentAmount: FieldValue.increment(amount),
        contributions: FieldValue.arrayUnion(contribution),
        milestones: updatedMilestones,
        isCompleted,
        completedAt: isCompleted && !goalData.completedAt ? new Date().toISOString() : goalData.completedAt,
        updatedAt: new Date().toISOString()
      });

      return { newCurrentAmount, isCompleted };
    });

    // Invalidate caches non-blocking
    Promise.all([
      cache.invalidatePatternAsync(`goals:${userId}:*`),
      cache.delAsync(buildGoalCacheKey(goalId))
    ]).catch((err) => {
      logger.warn('Cache invalidation failed for contribution', { 
        goalId, userId, error: err instanceof Error ? err.message : 'Unknown error'
      });
    });

    res.json({ 
      success: true, 
      data: {
        currentAmount: result.newCurrentAmount,
        isCompleted: result.isCompleted
      },
      message: 'Contribution added successfully'
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error adding contribution', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      goalId: req.params.goalId, 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to add contribution', 500, false));
  }
};

/**
 * Update goal
 */
export const updateGoal = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { goalId } = req.params;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const goalRef = db.collection('goals').doc(goalId);
    const goalDoc = await goalRef.get();

    if (!goalDoc.exists) {
      throw new AppError('Goal not found', 404, true);
    }

    const goalData = goalDoc.data() as SavingsGoal;
    
    if (goalData.userId !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    // Whitelist allowed update fields to prevent overwriting protected fields
    const { name, description, targetAmount, targetDate, category, priority } = req.body;
    const updateData: Partial<SavingsGoal> & { updatedAt: string } = {
      updatedAt: new Date().toISOString()
    };

    // Validate and assign name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new AppError('Name must be a non-empty string', 400, true);
      }
      if (name.length > 100) {
        throw new AppError('Name cannot exceed 100 characters', 400, true);
      }
      updateData.name = name.trim();
    }
    
    // Validate and assign description
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        throw new AppError('Description must be a string', 400, true);
      }
      updateData.description = description?.trim() || undefined;
    }
    
    // Validate and assign targetAmount
    if (targetAmount !== undefined) {
      const numericAmount = Number(targetAmount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new AppError('Target amount must be a positive number', 400, true);
      }
      updateData.targetAmount = numericAmount;
    }
    
    // Validate and assign targetDate
    if (targetDate !== undefined) {
      if (typeof targetDate !== 'string' || isNaN(Date.parse(targetDate))) {
        throw new AppError('Target date must be a valid date', 400, true);
      }
      updateData.targetDate = targetDate;
    }
    
    // Validate and assign category
    if (category !== undefined) {
      const validCategories = ['emergency', 'vacation', 'home', 'car', 'education', 'retirement', 'other'] as const;
      const trimmedCategory = typeof category === 'string' ? category.trim() : category;
      if (!validCategories.includes(trimmedCategory as typeof validCategories[number])) {
        throw new AppError(`Category must be one of: ${validCategories.join(', ')}`, 400, true);
      }
      updateData.category = trimmedCategory as SavingsGoal['category'];
    }
    
    // Validate and assign priority
    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority)) {
        throw new AppError(`Priority must be one of: ${validPriorities.join(', ')}`, 400, true);
      }
      updateData.priority = priority;
    }

    await goalRef.update(updateData);

    // Invalidate caches
    await Promise.all([
      cache.invalidatePatternAsync(`goals:${userId}:*`),
      cache.delAsync(buildGoalCacheKey(goalId))
    ]);

    res.json({ success: true, message: 'Goal updated successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error updating goal', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      goalId: req.params.goalId, 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to update goal', 500, false));
  }
};

/**
 * Delete goal
 */
export const deleteGoal = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { goalId } = req.params;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const goalRef = db.collection('goals').doc(goalId);
    const goalDoc = await goalRef.get();

    if (!goalDoc.exists) {
      throw new AppError('Goal not found', 404, true);
    }

    const goalData = goalDoc.data() as SavingsGoal;
    
    if (goalData.userId !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    await goalRef.delete();

    // Invalidate caches
    await Promise.all([
      cache.invalidatePatternAsync(`goals:${userId}:*`),
      cache.delAsync(buildGoalCacheKey(goalId))
    ]);

    res.json({ success: true, message: 'Goal deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error deleting goal', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      goalId: req.params.goalId, 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to delete goal', 500, false));
  }
};
