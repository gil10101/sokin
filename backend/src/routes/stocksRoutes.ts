/**
 * Stocks Routes
 * 
 * RESTful routes for stock market data, portfolio management,
 * and trading operations.
 * 
 * @module routes/stocksRoutes
 */

import { Router } from 'express';
import stocksController from '../controllers/stocksController';
import { auth } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { createRateLimiter } from '../middleware/rateLimiter';
import { stockSymbolParamsSchema } from '../models/schemas';
import Joi from 'joi';

const router = Router();

// Rate limiting for stock API calls (more lenient than other endpoints)
const stocksRateLimit = createRateLimiter.read();
const writeRateLimit = createRateLimiter.api();

// Validation schemas using Joi
const transactionSchema = Joi.object({
  symbol: Joi.string().min(1).max(10).pattern(/^[A-Z^]+$/).required()
    .messages({ 'string.pattern.base': 'Invalid stock symbol format' }),
  type: Joi.string().valid('buy', 'sell').required(),
  amount: Joi.number().positive().required()
    .messages({ 'number.positive': 'Amount must be positive' }),
  price: Joi.number().positive().required()
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
router.get('/market-indices', stocksRateLimit, asyncHandler(stocksController.getMarketIndices));

/**
 * @route   GET /api/stocks/trending
 * @desc    Get trending stocks
 * @access  Public
 */
router.get('/trending', stocksRateLimit, asyncHandler(stocksController.getTrendingStocks));

/**
 * @route   GET /api/stocks/search
 * @desc    Search for stocks by symbol or company name
 * @access  Public
 */
router.get('/search', stocksRateLimit, asyncHandler(stocksController.searchStocks));

/**
 * @route   GET /api/stocks/stock/:symbol
 * @desc    Get stock data for a specific symbol
 * @access  Public
 */
router.get('/stock/:symbol', stocksRateLimit, validateParams(stockSymbolParamsSchema), asyncHandler(stocksController.getStockData));

/**
 * Protected routes (require authentication)
 */

/**
 * @route   GET /api/stocks/portfolio
 * @desc    Get user's stock portfolio (userId derived from auth token)
 * @access  Private
 */
router.get(
  '/portfolio', 
  stocksRateLimit,
  auth,
  asyncHandler(stocksController.getUserPortfolio)
);

/**
 * @route   POST /api/stocks/transaction
 * @desc    Execute a stock transaction (buy/sell)
 * @access  Private
 */
router.post(
  '/transaction', 
  writeRateLimit,
  auth, 
  validate(transactionSchema),
  asyncHandler(stocksController.executeTransaction)
);

/**
 * @route   GET /api/stocks/max-sell/:symbol
 * @desc    Get maximum sellable amount for a stock
 * @access  Private
 */
router.get(
  '/max-sell/:symbol', 
  stocksRateLimit,
  auth,
  validateParams(stockSymbolParamsSchema),
  asyncHandler(stocksController.getMaxSellAmount)
);

/**
 * @route   GET /api/stocks/transactions
 * @desc    Get user's transaction history
 * @access  Private
 */
router.get(
  '/transactions', 
  stocksRateLimit,
  auth, 
  asyncHandler(stocksController.getTransactionHistory)
);

/**
 * @route   GET /api/stocks/watchlist
 * @desc    Get user's watchlist
 * @access  Private
 */
router.get(
  '/watchlist',
  stocksRateLimit,
  auth,
  asyncHandler(stocksController.getUserWatchlist)
);

/**
 * @route   POST /api/stocks/watchlist
 * @desc    Add symbol to watchlist
 * @access  Private
 */
router.post(
  '/watchlist',
  writeRateLimit,
  auth,
  asyncHandler(stocksController.addToWatchlist)
);

/**
 * @route   PUT /api/stocks/watchlist
 * @desc    Update entire watchlist
 * @access  Private
 */
router.put(
  '/watchlist',
  writeRateLimit,
  auth,
  asyncHandler(stocksController.updateWatchlist)
);

/**
 * @route   DELETE /api/stocks/watchlist/:symbol
 * @desc    Remove symbol from watchlist
 * @access  Private
 */
router.delete(
  '/watchlist/:symbol',
  writeRateLimit,
  auth,
  validateParams(stockSymbolParamsSchema),
  asyncHandler(stocksController.removeFromWatchlist)
);

export default router;
