"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const schemas_1 = require("../models/schemas");
const expenses_1 = require("../controllers/expenses");
const router = express_1.default.Router();
// Apply rate limiting - more lenient for read operations
const readRateLimit = rateLimiter_1.createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = rateLimiter_1.createRateLimiter.api(); // 100 requests per 15 minutes
// Get all expenses for a user
router.get('/', readRateLimit, auth_1.auth, expenses_1.getAllExpenses);
// Get a specific expense
router.get('/:id', readRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), expenses_1.getExpenseById);
// Create a new expense
router.post('/', writeRateLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.createExpenseSchema), expenses_1.createExpense);
// Update an expense
router.put('/:id', writeRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), (0, validation_1.validate)(schemas_1.updateExpenseSchema), expenses_1.updateExpense);
// Delete an expense
router.delete('/:id', writeRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.idParamsSchema), expenses_1.deleteExpense);
exports.default = router;
