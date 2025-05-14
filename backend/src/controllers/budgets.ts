import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache from '../utils/cache';
import { DocumentData } from 'firebase-admin/firestore';

// Get all budgets for a user
export const getAllBudgets = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, true);
    }

    const userId = req.user.uid;
    const cacheKey = `budgets_${userId}`;
    
    // Try to get from cache first
    const cachedBudgets = cache.get(cacheKey);
    if (cachedBudgets) {
      res.status(200).json({ data: cachedBudgets });
      return;
    }

    // Get budgets from database
    const budgetsRef = db.collection('budgets');
    const budgetsSnapshot = await budgetsRef.where('userId', '==', userId).get();
    
    const budgets = budgetsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Cache budgets data (30 seconds)
    cache.set(cacheKey, budgets, 30);
    
    res.status(200).json({ data: budgets });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in getAllBudgets: ${errorMessage}`);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
};

// Get a specific budget
export const getBudgetById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, true);
    }

    const userId = req.user.uid;
    const budgetId = req.params.id;
    
    // Get budget from database
    const budgetDoc = await db.collection('budgets').doc(budgetId).get();
    
    if (!budgetDoc.exists) {
      throw new AppError('Budget not found', 404, true);
    }
    
    const budgetData = budgetDoc.data();
    
    if (!budgetData) {
      throw new AppError('Budget data is missing', 404, true);
    }
    
    // Verify the budget belongs to the requesting user
    if (budgetData.userId !== userId) {
      throw new AppError('Forbidden: You do not have access to this budget', 403, true);
    }
    
    res.status(200).json({ 
      data: {
        id: budgetDoc.id,
        ...budgetData
      }
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in getBudgetById: ${errorMessage}`);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
};

// Create a new budget
export const createBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, true);
    }

    const { name, amount, period, categories, startDate, endDate } = req.body;
    
    const budgetData = {
      userId: req.user.uid,
      name,
      amount: Number(amount),
      period,
      categories: categories || [],
      startDate,
      endDate: endDate || null,
      createdAt: new Date().toISOString(),
    };
    
    const budgetRef = await db.collection('budgets').add(budgetData);
    
    // Clear cache
    cache.del(`budgets_${req.user.uid}`);
    
    res.status(201).json({ 
      data: {
        id: budgetRef.id,
        ...budgetData
      },
      message: 'Budget created successfully'
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in createBudget: ${errorMessage}`);
    res.status(500).json({ error: 'Failed to create budget' });
  }
};

// Update a budget
export const updateBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, true);
    }

    const userId = req.user.uid;
    const budgetId = req.params.id;
    
    // Get budget document
    const budgetDoc = await db.collection('budgets').doc(budgetId).get();
    
    if (!budgetDoc.exists) {
      throw new AppError('Budget not found', 404, true);
    }
    
    const budgetData = budgetDoc.data();
    
    if (!budgetData) {
      throw new AppError('Budget data is missing', 404, true);
    }
    
    // Verify the budget belongs to the requesting user
    if (budgetData.userId !== userId) {
      throw new AppError('Forbidden: You do not have access to this budget', 403, true);
    }
    
    // Build update object with only provided fields
    const { name, amount, period, categories, startDate, endDate } = req.body;
    const updateData: Record<string, any> = {};
    
    if (name !== undefined) updateData.name = name;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (period !== undefined) updateData.period = period;
    if (categories !== undefined) updateData.categories = categories;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    updateData.updatedAt = new Date().toISOString();
    
    await db.collection('budgets').doc(budgetId).update(updateData);
    
    // Clear cache
    cache.del(`budgets_${userId}`);
    
    res.status(200).json({ 
      data: {
        id: budgetId,
        ...budgetData,
        ...updateData
      },
      message: 'Budget updated successfully'
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in updateBudget: ${errorMessage}`);
    res.status(500).json({ error: 'Failed to update budget' });
  }
};

// Delete a budget
export const deleteBudget = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, true);
    }

    const userId = req.user.uid;
    const budgetId = req.params.id;
    
    // Get budget document
    const budgetDoc = await db.collection('budgets').doc(budgetId).get();
    
    if (!budgetDoc.exists) {
      throw new AppError('Budget not found', 404, true);
    }
    
    const budgetData = budgetDoc.data();
    
    if (!budgetData) {
      throw new AppError('Budget data is missing', 404, true);
    }
    
    // Verify the budget belongs to the requesting user
    if (budgetData.userId !== userId) {
      throw new AppError('Forbidden: You do not have access to this budget', 403, true);
    }
    
    await db.collection('budgets').doc(budgetId).delete();
    
    // Clear cache
    cache.del(`budgets_${userId}`);
    
    res.status(200).json({ 
      message: 'Budget deleted successfully'
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in deleteBudget: ${errorMessage}`);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
}; 