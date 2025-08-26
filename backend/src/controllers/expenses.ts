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

    const { name, amount, date, category, description, tags, receiptImageUrl, receiptData } = req.body;

    // Basic validation
    if (!name || !amount || !date || !category) {
      res.status(400).json({ error: 'Missing required fields: name, amount, date, and category are required' });
      return;
    }

    const expenseData = {
      userId: req.user.uid,
      name,
      amount: Number(amount),
      date,
      category,
      description: description || '',
      tags: tags || [],
      receiptImageUrl: receiptImageUrl || '',
      receiptData: receiptData || null,
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

    const { name, amount, date, category, description, tags, receiptImageUrl, receiptData } = req.body;
    
    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (name) updateData.name = name;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (date) updateData.date = date;
    if (category) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (tags) updateData.tags = tags;
    if (receiptImageUrl !== undefined) updateData.receiptImageUrl = receiptImageUrl;
    if (receiptData !== undefined) updateData.receiptData = receiptData;
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
    res.status(500).json({ error: 'Failed to delete expense' });
  }
}; 