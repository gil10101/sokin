/**
 * Dashboard Routes
 * 
 * Routes for dashboard data aggregation with rate limiting
 * and authentication middleware.
 * 
 * @module routes/dashboard
 */

import { Router } from 'express';
import { getDashboard } from '../controllers/dashboardController';
import { auth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply rate limiting for read operations
const readRateLimit = createRateLimiter.read(); // 200 requests per 15 minutes

/**
 * @route   GET /api/dashboard
 * @desc    Get dashboard summary data (expenses, budgets, notifications)
 * @access  Private
 */
router.get('/', auth, readRateLimit, asyncHandler(getDashboard));

export default router;
