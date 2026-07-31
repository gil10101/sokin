/**
 * AI Routes
 *
 * Claude-backed suggestions and summaries. Every route is optional at runtime:
 * without ANTHROPIC_API_KEY they answer 503 with a reason the client can render,
 * rather than failing the page.
 *
 * @module routes/ai
 */

import { Router } from 'express';
import { getAiStatus, categorizeExpense, getSpendingInsights } from '../controllers/aiController';
import { auth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

const readRateLimit = createRateLimiter.read();
// Each call costs real money upstream, so this is deliberately tighter than
// any other read budget - 30 per 15 minutes is generous for a person and
// still bounds the spend a runaway client can cause.
const aiRateLimit = createRateLimiter.custom(30, 15 * 60 * 1000);

/**
 * @route   GET /api/ai/status
 * @desc    Whether AI features are configured on this deployment
 * @access  Private
 */
router.get('/status', auth, readRateLimit, asyncHandler(getAiStatus));

/**
 * @route   POST /api/ai/categorize
 * @desc    Suggest a category for an expense being entered
 * @access  Private
 */
router.post('/categorize', auth, aiRateLimit, asyncHandler(categorizeExpense));

/**
 * @route   GET /api/ai/insights
 * @desc    Written summary of this month's spending, from server aggregates
 * @access  Private
 */
router.get('/insights', auth, aiRateLimit, asyncHandler(getSpendingInsights));

export default router;
