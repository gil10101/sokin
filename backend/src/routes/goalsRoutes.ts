/**
 * Goals Routes
 * 
 * RESTful routes for savings goals management with rate limiting,
 * authentication, and error handling middleware.
 * 
 * @module routes/goalsRoutes
 */

import { Router } from 'express';
import { 
  getUserGoals, 
  createGoal, 
  addContribution, 
  updateGoal, 
  deleteGoal 
} from '../controllers/goalsController';
import { auth } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';
import { createGoalSchema, updateGoalSchema, contributeGoalSchema, goalIdParamsSchema } from '../models/schemas';

const router = Router();

// Apply rate limiting
const readRateLimit = createRateLimiter.read();
const writeRateLimit = createRateLimiter.api();

/**
 * @route   GET /api/goals
 * @desc    Get user's savings goals
 * @access  Private
 */
router.get('/', auth, readRateLimit, asyncHandler(getUserGoals));

/**
 * @route   POST /api/goals
 * @desc    Create new savings goal
 * @access  Private
 */
router.post('/', auth, writeRateLimit, validate(createGoalSchema), asyncHandler(createGoal));

/**
 * @route   POST /api/goals/:goalId/contribute
 * @desc    Add contribution to goal
 * @access  Private
 */
router.post('/:goalId/contribute', auth, writeRateLimit, validateParams(goalIdParamsSchema), validate(contributeGoalSchema), asyncHandler(addContribution));

/**
 * @route   PUT /api/goals/:goalId
 * @desc    Update goal
 * @access  Private
 */
router.put('/:goalId', auth, writeRateLimit, validateParams(goalIdParamsSchema), validate(updateGoalSchema), asyncHandler(updateGoal));

/**
 * @route   DELETE /api/goals/:goalId
 * @desc    Delete goal
 * @access  Private
 */
router.delete('/:goalId', auth, writeRateLimit, validateParams(goalIdParamsSchema), asyncHandler(deleteGoal));

export default router; 
