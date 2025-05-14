import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

// Get all expenses for a user
export const getAllExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      res.status(401).json({ error: 'Unauthorized: User ID missing' });
      return;
    }

    if (!db) {
      res.status(500).json({ error: 'Database not initialized' });
      return;
    }

    const expensesRef = db.collection('expenses');
    const expensesSnapshot = await expensesRef.where('userId', '==', req.user.uid).get();
    
    const expenses = expensesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({ data: expenses });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

// Get a specific expense
export const getExpenseById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      res.status(401).json({ error: 'Unauthorized: User ID missing' });
      return;
    }

    if (!db) {
      res.status(500).json({ error: 'Database not initialized' });
      return;
    }

    const expenseId = req.params.id;
    const expenseDoc = await db.collection('expenses').doc(expenseId).get();

    if (!expenseDoc.exists) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const expenseData = expenseDoc.data();
    
    if (!expenseData) {
      res.status(404).json({ error: 'Expense data is missing' });
      return;
    }
    
    // Verify the expense belongs to the requesting user
    if (expenseData.userId !== req.user.uid) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this expense' });
      return;
    }

    res.status(200).json({ 
      data: {
        id: expenseDoc.id,
        ...expenseData
      }
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
};

// Create a new expense
export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      res.status(401).json({ error: 'Unauthorized: User ID missing' });
      return;
    }

    if (!db) {
      res.status(500).json({ error: 'Database not initialized' });
      return;
    }

    const { amount, date, category, description, tags } = req.body;

    // Basic validation
    if (!amount || !date || !category) {
      res.status(400).json({ error: 'Missing required fields: amount, date, and category are required' });
      return;
    }

    const expenseData = {
      userId: req.user.uid,
      amount: Number(amount),
      date,
      category,
      description: description || '',
      tags: tags || [],
      createdAt: new Date().toISOString(),
    };

    const expenseRef = await db.collection('expenses').add(expenseData);
    
    res.status(201).json({ 
      data: {
        id: expenseRef.id,
        ...expenseData
      },
      message: 'Expense created successfully'
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

// Update an expense
export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      res.status(401).json({ error: 'Unauthorized: User ID missing' });
      return;
    }

    if (!db) {
      res.status(500).json({ error: 'Database not initialized' });
      return;
    }

    const expenseId = req.params.id;
    const expenseDoc = await db.collection('expenses').doc(expenseId).get();

    if (!expenseDoc.exists) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const expenseData = expenseDoc.data();
    
    if (!expenseData) {
      res.status(404).json({ error: 'Expense data is missing' });
      return;
    }
    
    // Verify the expense belongs to the requesting user
    if (expenseData.userId !== req.user.uid) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this expense' });
      return;
    }

    const { amount, date, category, description, tags } = req.body;
    
    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (amount !== undefined) updateData.amount = Number(amount);
    if (date) updateData.date = date;
    if (category) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (tags) updateData.tags = tags;
    updateData.updatedAt = new Date().toISOString();

    await db.collection('expenses').doc(expenseId).update(updateData);
    
    res.status(200).json({ 
      data: {
        id: expenseId,
        ...expenseData,
        ...updateData
      },
      message: 'Expense updated successfully'
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

// Delete an expense
export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      res.status(401).json({ error: 'Unauthorized: User ID missing' });
      return;
    }

    if (!db) {
      res.status(500).json({ error: 'Database not initialized' });
      return;
    }

    const expenseId = req.params.id;
    const expenseDoc = await db.collection('expenses').doc(expenseId).get();

    if (!expenseDoc.exists) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const expenseData = expenseDoc.data();
    
    if (!expenseData) {
      res.status(404).json({ error: 'Expense data is missing' });
      return;
    }
    
    // Verify the expense belongs to the requesting user
    if (expenseData.userId !== req.user.uid) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this expense' });
      return;
    }

    await db.collection('expenses').doc(expenseId).delete();
    
    res.status(200).json({ 
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
}; 