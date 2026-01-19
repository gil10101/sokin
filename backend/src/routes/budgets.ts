/**
 * Budget Routes
 * 
 * RESTful routes for budget management with rate limiting,
 * authentication, and validation middleware. Supports cursor-based
 * pagination for efficient data retrieval.
 * 
 * @module routes/budgets
 */

import express from 'express';
import { auth } from '../middleware/auth';
import { validate, validateParams, validateQuery } from '../middleware/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';
import { createBudgetSchema, updateBudgetSchema, idParamsSchema, budgetsPaginationSchema } from '../models/schemas';
import { 
  getAllBudgets, 
  getBudgetById, 
  createBudget, 
  updateBudget, 
  deleteBudget 
} from '../controllers/budgets';

const router = express.Router();

// Apply rate limiting
const readRateLimit = createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = createRateLimiter.api(); // 100 requests per 15 minutes

/**
 * @route   GET /api/budgets
 * @desc    Get paginated budgets for authenticated user
 * @query   limit - Number of items (1-100, default: 50)
 * @query   cursor - Pagination cursor (document ID)
 * @query   sortOrder - 'asc' or 'desc' (default: 'desc')
 * @query   sortBy - 'createdAt', 'amount', 'name', 'startDate' (default: 'createdAt')
 * @query   period - Filter by period type
 * @query   activeOnly - Filter active budgets only
 * @access  Private
 */
router.get('/', readRateLimit, auth, validateQuery(budgetsPaginationSchema), asyncHandler(getAllBudgets));

/**
 * @route   GET /api/budgets/:id
 * @desc    Get a specific budget by ID
 * @access  Private (owner only)
 */
router.get('/:id', readRateLimit, auth, validateParams(idParamsSchema), asyncHandler(getBudgetById));

/**
 * @route   POST /api/budgets
 * @desc    Create a new budget
 * @access  Private
 */
router.post('/', writeRateLimit, auth, validate(createBudgetSchema), asyncHandler(createBudget));

/**
 * @route   PUT /api/budgets/:id
 * @desc    Update an existing budget
 * @access  Private (owner only)
 */
router.put('/:id', writeRateLimit, auth, validateParams(idParamsSchema), validate(updateBudgetSchema), asyncHandler(updateBudget));

/**
 * @route   DELETE /api/budgets/:id
 * @desc    Delete a budget
 * @access  Private (owner only)
 */
router.delete('/:id', writeRateLimit, auth, validateParams(idParamsSchema), asyncHandler(deleteBudget));

export default router; 
