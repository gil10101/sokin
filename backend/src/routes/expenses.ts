import express from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createExpenseSchema, updateExpenseSchema } from '../models/schemas';
import { getAllExpenses, getExpenseById, createExpense, updateExpense, deleteExpense } from '../controllers/expenses';

const router = express.Router();

// Get all expenses for a user
router.get('/', auth, getAllExpenses);

// Get a specific expense
router.get('/:id', auth, getExpenseById);

// Create a new expense
router.post('/', auth, validate(createExpenseSchema), createExpense);

// Update an expense
router.put('/:id', auth, validate(updateExpenseSchema), updateExpense);

// Delete an expense
router.delete('/:id', auth, deleteExpense);

export default router; 