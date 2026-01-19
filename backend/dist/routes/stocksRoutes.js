"use strict";
/**
 * Stocks Routes
 *
 * RESTful routes for stock market data, portfolio management,
 * and trading operations.
 *
 * @module routes/stocksRoutes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stocksController_1 = __importDefault(require("../controllers/stocksController"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const rateLimiter_1 = require("../middleware/rateLimiter");
const schemas_1 = require("../models/schemas");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// Rate limiting for stock API calls (more lenient than other endpoints)
const stocksRateLimit = rateLimiter_1.createRateLimiter.read();
const writeRateLimit = rateLimiter_1.createRateLimiter.api();
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
/**
 * Public routes (no authentication required for basic market data)
 */
/**
 * @route   GET /api/stocks/market-indices
 * @desc    Get major market indices
 * @access  Public
 */
router.get('/market-indices', stocksRateLimit, (0, errorHandler_1.asyncHandler)(stocksController_1.default.getMarketIndices));
/**
 * @route   GET /api/stocks/trending
 * @desc    Get trending stocks
 * @access  Public
 */
router.get('/trending', stocksRateLimit, (0, errorHandler_1.asyncHandler)(stocksController_1.default.getTrendingStocks));
/**
 * @route   GET /api/stocks/search
 * @desc    Search for stocks by symbol or company name
 * @access  Public
 */
router.get('/search', stocksRateLimit, (0, errorHandler_1.asyncHandler)(stocksController_1.default.searchStocks));
/**
 * @route   GET /api/stocks/stock/:symbol
 * @desc    Get stock data for a specific symbol
 * @access  Public
 */
router.get('/stock/:symbol', stocksRateLimit, (0, validation_1.validateParams)(schemas_1.stockSymbolParamsSchema), (0, errorHandler_1.asyncHandler)(stocksController_1.default.getStockData));
/**
 * Protected routes (require authentication)
 */
/**
 * @route   GET /api/stocks/portfolio
 * @desc    Get user's stock portfolio (userId derived from auth token)
 * @access  Private
 */
router.get('/portfolio', stocksRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(stocksController_1.default.getUserPortfolio));
/**
 * @route   POST /api/stocks/transaction
 * @desc    Execute a stock transaction (buy/sell)
 * @access  Private
 */
router.post('/transaction', writeRateLimit, auth_1.auth, (0, validation_1.validate)(transactionSchema), (0, errorHandler_1.asyncHandler)(stocksController_1.default.executeTransaction));
/**
 * @route   GET /api/stocks/max-sell/:symbol
 * @desc    Get maximum sellable amount for a stock
 * @access  Private
 */
router.get('/max-sell/:symbol', stocksRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.stockSymbolParamsSchema), (0, errorHandler_1.asyncHandler)(stocksController_1.default.getMaxSellAmount));
/**
 * @route   GET /api/stocks/transactions
 * @desc    Get user's transaction history
 * @access  Private
 */
router.get('/transactions', stocksRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(stocksController_1.default.getTransactionHistory));
/**
 * @route   GET /api/stocks/watchlist
 * @desc    Get user's watchlist
 * @access  Private
 */
router.get('/watchlist', stocksRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(stocksController_1.default.getUserWatchlist));
/**
 * @route   POST /api/stocks/watchlist
 * @desc    Add symbol to watchlist
 * @access  Private
 */
router.post('/watchlist', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(stocksController_1.default.addToWatchlist));
/**
 * @route   PUT /api/stocks/watchlist
 * @desc    Update entire watchlist
 * @access  Private
 */
router.put('/watchlist', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(stocksController_1.default.updateWatchlist));
/**
 * @route   DELETE /api/stocks/watchlist/:symbol
 * @desc    Remove symbol from watchlist
 * @access  Private
 */
router.delete('/watchlist/:symbol', writeRateLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.stockSymbolParamsSchema), (0, errorHandler_1.asyncHandler)(stocksController_1.default.removeFromWatchlist));
exports.default = router;
