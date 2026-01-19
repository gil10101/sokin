"use strict";
/**
 * Dashboard Routes
 *
 * Routes for dashboard data aggregation with rate limiting
 * and authentication middleware.
 *
 * @module routes/dashboard
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardController_1 = require("../controllers/dashboardController");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// Apply rate limiting for read operations
const readRateLimit = rateLimiter_1.createRateLimiter.read(); // 200 requests per 15 minutes
/**
 * @route   GET /api/dashboard
 * @desc    Get dashboard summary data (expenses, budgets, notifications)
 * @access  Private
 */
router.get('/', readRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(dashboardController_1.getDashboard));
exports.default = router;
