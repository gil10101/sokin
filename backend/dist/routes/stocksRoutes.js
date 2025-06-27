"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stocksController_1 = __importDefault(require("../controllers/stocksController"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Rate limiting for stock API calls (more lenient than other endpoints)
const stocksRateLimit = (0, rateLimiter_1.rateLimiter)(100, 60 * 1000); // 100 requests per minute (increased from 30)
// Validation schemas using Joi
const transactionSchema = joi_1.default.object({
    symbol: joi_1.default.string().min(1).max(10).pattern(/^[A-Z^]+$/).required()
        .messages({ 'string.pattern.base': 'Invalid stock symbol format' }),
    type: joi_1.default.string().valid('buy', 'sell').required(),
    amount: joi_1.default.number().positive().required()
        .messages({ 'number.positive': 'Amount must be positive' }),
    price: joi_1.default.number().positive().required()
        .messages({ 'number.positive': 'Price must be positive' })
});
// Public routes (no authentication required for basic market data)
router.get('/market-indices', stocksRateLimit, stocksController_1.default.getMarketIndices);
router.get('/trending', stocksRateLimit, stocksController_1.default.getTrendingStocks);
router.get('/search', stocksRateLimit, stocksController_1.default.searchStocks);
router.get('/stock/:symbol', stocksRateLimit, stocksController_1.default.getStockData);
// Protected routes (require authentication)
router.get('/portfolio/:userId', auth_1.auth, stocksRateLimit, stocksController_1.default.getUserPortfolio);
// Transaction endpoints
router.post('/transaction', auth_1.auth, stocksRateLimit, (0, validation_1.validate)(transactionSchema), stocksController_1.default.executeTransaction);
router.get('/max-sell/:symbol', auth_1.auth, stocksRateLimit, stocksController_1.default.getMaxSellAmount);
router.get('/transactions', auth_1.auth, stocksRateLimit, stocksController_1.default.getTransactionHistory);
exports.default = router;
