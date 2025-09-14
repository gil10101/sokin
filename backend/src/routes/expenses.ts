import express from 'express';
import { auth } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createExpenseSchema, updateExpenseSchema, idParamsSchema } from '../models/schemas';
import { getAllExpenses, getExpenseById, createExpense, updateExpense, deleteExpense } from '../controllers/expenses';

const router = express.Router();

// Apply rate limiting - more lenient for read operations
const readRateLimit = createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = createRateLimiter.api(); // 100 requests per 15 minutes

// Get all expenses for a user
router.get('/', readRateLimit, auth, getAllExpenses);

// Get a specific expense
router.get('/:id', readRateLimit, auth, validateParams(idParamsSchema), getExpenseById);

// Create a new expense
router.post('/', writeRateLimit, auth, validate(createExpenseSchema), createExpense);

// Update an expense
router.put('/:id', writeRateLimit, auth, validateParams(idParamsSchema), validate(updateExpenseSchema), updateExpense);

// Delete an expense
router.delete('/:id', writeRateLimit, auth, validateParams(idParamsSchema), deleteExpense);

export default router; 