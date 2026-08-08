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
 * The watchlist write routes reached their controllers unvalidated, so the
 * 50-symbol ceiling in firestore.rules was never enforced on this path - the
 * backend writes with the Admin SDK, which bypasses rules entirely. A client
 * could send as many symbols as fit in the 1MB body limit and have them
 * stored. These schemas restore the ceiling where it is actually applied.
 */
const MAX_WATCHLIST_SYMBOLS = 50;

const watchlistSymbolSchema = Joi.string().trim().uppercase().min(1).max(10)
  .pattern(/^[A-Z0-9.^]+$/)
  .messages({ 'string.pattern.base': 'Invalid stock symbol format' });

const addToWatchlistSchema = Joi.object({
  symbol: watchlistSymbolSchema.required()
});

const updateWatchlistSchema = Joi.object({
  symbols: Joi.array()
    .items(watchlistSymbolSchema)
    .max(MAX_WATCHLIST_SYMBOLS)
    .required()
    .messages({ 'array.max': `A watchlist can hold at most ${MAX_WATCHLIST_SYMBOLS} symbols` })
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
  auth, stocksRateLimit,
  asyncHandler(stocksController.getUserPortfolio)
);

/**
 * @route   POST /api/stocks/transaction
 * @desc    Execute a stock transaction (buy/sell)
 * @access  Private
 */
router.post(
  '/transaction', 
  auth, writeRateLimit, 
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
  auth, stocksRateLimit,
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
  auth, stocksRateLimit, 
  asyncHandler(stocksController.getTransactionHistory)
);

/**
 * @route   GET /api/stocks/watchlist
 * @desc    Get user's watchlist
 * @access  Private
 */
router.get(
  '/watchlist',
  auth, stocksRateLimit,
  asyncHandler(stocksController.getUserWatchlist)
);

/**
 * @route   POST /api/stocks/watchlist
 * @desc    Add symbol to watchlist
 * @access  Private
 */
router.post(
  '/watchlist',
  auth, writeRateLimit,
  validate(addToWatchlistSchema),
  asyncHandler(stocksController.addToWatchlist)
);

/**
 * @route   PUT /api/stocks/watchlist
 * @desc    Update entire watchlist
 * @access  Private
 */
router.put(
  '/watchlist',
  auth, writeRateLimit,
  validate(updateWatchlistSchema),
  asyncHandler(stocksController.updateWatchlist)
);

/**
 * @route   DELETE /api/stocks/watchlist/:symbol
 * @desc    Remove symbol from watchlist
 * @access  Private
 */
router.delete(
  '/watchlist/:symbol',
  auth, writeRateLimit,
  validateParams(stockSymbolParamsSchema),
  asyncHandler(stocksController.removeFromWatchlist)
);

export default router;
