"use strict";
/**
 * Expense Routes
 *
 * RESTful routes for expense management with rate limiting,
 * authentication, and validation middleware. Supports cursor-based
 * pagination for efficient data retrieval.
 *
 * @module routes/expenses
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const errorHandler_1 = require("../middleware/errorHandler");
const schemas_1 = require("../models/schemas");
const expenses_1 = require("../controllers/expenses");
const router = express_1.default.Router();
// Apply rate limiting - more lenient for read operations
const readRateLimit = rateLimiter_1.createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = rateLimiter_1.createRateLimiter.api(); // 100 requests per 15 minutes
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
router.get('/', readRateLimit, auth_1.auth, (0, validation_1.validateQuery)(schemas_1.expensesPaginationSchema), (0, errorHandler_1.asyncHandler)(expenses_1.getAllExpenses));
/**
 * @route   GET /api/expenses/analytics
 * @desc    Get expense analytics and spending insights
 * @query   timeframe - Timeframe: '3months', '6months', or '12months' (default: '6months')
 * @access  Private
 */
router.get('/analytics', readRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(expenses_1.getExpenseAnalytics));
/**
 * @route   GET /api/expenses/:id
 * @desc    Get a specific expense by ID
 * @access  Private (owner only)
 */
router.get('/:id', readRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), (0, errorHandler_1.asyncHandler)(expenses_1.getExpenseById));
/**
 * @route   POST /api/expenses
 * @desc    Create a new expense
 * @access  Private
 */
router.post('/', writeRateLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.createExpenseSchema), (0, errorHandler_1.asyncHandler)(expenses_1.createExpense));
/**
 * @route   PUT /api/expenses/:id
 * @desc    Update an existing expense
 * @access  Private (owner only)
 */
router.put('/:id', writeRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), (0, validation_1.validate)(schemas_1.updateExpenseSchema), (0, errorHandler_1.asyncHandler)(expenses_1.updateExpense));
/**
 * @route   DELETE /api/expenses/:id
 * @desc    Delete an expense
 * @access  Private (owner only)
 */
router.delete('/:id', writeRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), (0, errorHandler_1.asyncHandler)(expenses_1.deleteExpense));
exports.default = router;
