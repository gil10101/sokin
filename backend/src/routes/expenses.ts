/**
 * Expense Routes
 * 
 * RESTful routes for expense management with rate limiting,
 * authentication, and validation middleware. Supports cursor-based
 * pagination for efficient data retrieval.
 * 
 * @module routes/expenses
 */

import express from 'express';
import { auth } from '../middleware/auth';
import { validate, validateParams, validateQuery } from '../middleware/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';
import { createExpenseSchema, updateExpenseSchema, idParamsSchema, expensesPaginationSchema } from '../models/schemas';
import { getAllExpenses, getExpenseById, createExpense, updateExpense, deleteExpense, getExpenseAnalytics } from '../controllers/expenses';

const router = express.Router();

// Apply rate limiting - more lenient for read operations
const readRateLimit = createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = createRateLimiter.api(); // 100 requests per 15 minutes

/**
 * @route   GET /api/expenses
 * @desc    Get paginated expenses for authenticated user
 * @query   limit - Number of items (1-100, default: 50)
 * @query   cursor - Pagination cursor (document ID)
 * @query   sortOrder - 'asc' or 'desc' (default: 'desc')
 * @query   sortBy - 'date', 'createdAt', 'amount', 'name' (default: 'date')
 * @query   category - Filter by category
 * @query   startDate - Filter by start date (ISO)
 * @query   endDate - Filter by end date (ISO)
 * @access  Private
 */
router.get('/', auth, readRateLimit, validateQuery(expensesPaginationSchema), asyncHandler(getAllExpenses));

/**
 * @route   GET /api/expenses/analytics
 * @desc    Get expense analytics and spending insights
 * @query   timeframe - Timeframe: '3months', '6months', or '12months' (default: '6months')
 * @access  Private
 */
router.get('/analytics', auth, readRateLimit, asyncHandler(getExpenseAnalytics));

/**
 * @route   GET /api/expenses/:id
 * @desc    Get a specific expense by ID
 * @access  Private (owner only)
 */
router.get('/:id', auth, readRateLimit, validateParams(idParamsSchema), asyncHandler(getExpenseById));

/**
 * @route   POST /api/expenses
 * @desc    Create a new expense
 * @access  Private
 */
router.post('/', auth, writeRateLimit, validate(createExpenseSchema), asyncHandler(createExpense));

/**
 * @route   PUT /api/expenses/:id
 * @desc    Update an existing expense
 * @access  Private (owner only)
 */
router.put('/:id', auth, writeRateLimit, validateParams(idParamsSchema), validate(updateExpenseSchema), asyncHandler(updateExpense));

/**
 * @route   DELETE /api/expenses/:id
 * @desc    Delete an expense
 * @access  Private (owner only)
 */
router.delete('/:id', auth, writeRateLimit, validateParams(idParamsSchema), asyncHandler(deleteExpense));

export default router; 
