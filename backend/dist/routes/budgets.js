"use strict";
/**
 * Budget Routes
 *
 * RESTful routes for budget management with rate limiting,
 * authentication, and validation middleware. Supports cursor-based
 * pagination for efficient data retrieval.
 *
 * @module routes/budgets
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
const budgets_1 = require("../controllers/budgets");
const router = express_1.default.Router();
// Apply rate limiting
const readRateLimit = rateLimiter_1.createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = rateLimiter_1.createRateLimiter.api(); // 100 requests per 15 minutes
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
router.get('/', readRateLimit, auth_1.auth, (0, validation_1.validateQuery)(schemas_1.budgetsPaginationSchema), (0, errorHandler_1.asyncHandler)(budgets_1.getAllBudgets));
/**
 * @route   GET /api/budgets/:id
 * @desc    Get a specific budget by ID
 * @access  Private (owner only)
 */
router.get('/:id', readRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), (0, errorHandler_1.asyncHandler)(budgets_1.getBudgetById));
/**
 * @route   POST /api/budgets
 * @desc    Create a new budget
 * @access  Private
 */
router.post('/', writeRateLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.createBudgetSchema), (0, errorHandler_1.asyncHandler)(budgets_1.createBudget));
/**
 * @route   PUT /api/budgets/:id
 * @desc    Update an existing budget
 * @access  Private (owner only)
 */
router.put('/:id', writeRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), (0, validation_1.validate)(schemas_1.updateBudgetSchema), (0, errorHandler_1.asyncHandler)(budgets_1.updateBudget));
/**
 * @route   DELETE /api/budgets/:id
 * @desc    Delete a budget
 * @access  Private (owner only)
 */
router.delete('/:id', writeRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), (0, errorHandler_1.asyncHandler)(budgets_1.deleteBudget));
exports.default = router;
