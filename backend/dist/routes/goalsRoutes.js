"use strict";
/**
 * Goals Routes
 *
 * RESTful routes for savings goals management with rate limiting,
 * authentication, and error handling middleware.
 *
 * @module routes/goalsRoutes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const goalsController_1 = require("../controllers/goalsController");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// Apply rate limiting
const readRateLimit = rateLimiter_1.createRateLimiter.read();
const writeRateLimit = rateLimiter_1.createRateLimiter.api();
/**
 * @route   GET /api/goals
 * @desc    Get user's savings goals
 * @access  Private
 */
router.get('/', readRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(goalsController_1.getUserGoals));
/**
 * @route   POST /api/goals
 * @desc    Create new savings goal
 * @access  Private
 */
router.post('/', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(goalsController_1.createGoal));
/**
 * @route   POST /api/goals/:goalId/contribute
 * @desc    Add contribution to goal
 * @access  Private
 */
router.post('/:goalId/contribute', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(goalsController_1.addContribution));
/**
 * @route   PUT /api/goals/:goalId
 * @desc    Update goal
 * @access  Private
 */
router.put('/:goalId', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(goalsController_1.updateGoal));
/**
 * @route   DELETE /api/goals/:goalId
 * @desc    Delete goal
 * @access  Private
 */
router.delete('/:goalId', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(goalsController_1.deleteGoal));
exports.default = router;
