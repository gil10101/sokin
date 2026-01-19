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
import { createRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply rate limiting
const readRateLimit = createRateLimiter.read();
const writeRateLimit = createRateLimiter.api();

/**
 * @route   GET /api/goals
 * @desc    Get user's savings goals
 * @access  Private
 */
router.get('/', readRateLimit, auth, asyncHandler(getUserGoals));

/**
 * @route   POST /api/goals
 * @desc    Create new savings goal
 * @access  Private
 */
router.post('/', writeRateLimit, auth, asyncHandler(createGoal));

/**
 * @route   POST /api/goals/:goalId/contribute
 * @desc    Add contribution to goal
 * @access  Private
 */
router.post('/:goalId/contribute', writeRateLimit, auth, asyncHandler(addContribution));

/**
 * @route   PUT /api/goals/:goalId
 * @desc    Update goal
 * @access  Private
 */
router.put('/:goalId', writeRateLimit, auth, asyncHandler(updateGoal));

/**
 * @route   DELETE /api/goals/:goalId
 * @desc    Delete goal
 * @access  Private
 */
router.delete('/:goalId', writeRateLimit, auth, asyncHandler(deleteGoal));

export default router; 
