import { Router } from 'express'
import stocksController from '../controllers/stocksController'
import { auth } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { rateLimiter } from '../middleware/rateLimiter'
import Joi from 'joi'

const router = Router()

// Rate limiting for stock API calls (more lenient than other endpoints)
const stocksRateLimit = rateLimiter(100, 60 * 1000) // 100 requests per minute (increased from 30)

// Validation schemas using Joi
const transactionSchema = Joi.object({
  symbol: Joi.string().min(1).max(10).pattern(/^[A-Z^]+$/).required()
    .messages({ 'string.pattern.base': 'Invalid stock symbol format' }),
  type: Joi.string().valid('buy', 'sell').required(),
  amount: Joi.number().positive().required()
    .messages({ 'number.positive': 'Amount must be positive' }),
  price: Joi.number().positive().required()
    .messages({ 'number.positive': 'Price must be positive' })
})

// Public routes (no authentication required for basic market data)
router.get('/market-indices', stocksRateLimit, stocksController.getMarketIndices)
router.get('/trending', stocksRateLimit, stocksController.getTrendingStocks)
router.get('/search', stocksRateLimit, stocksController.searchStocks)
router.get('/stock/:symbol', stocksRateLimit, stocksController.getStockData)

// Protected routes (require authentication)
router.get('/portfolio/:userId', 
  auth, 
  stocksRateLimit, 
  stocksController.getUserPortfolio
)

// Transaction endpoints
router.post('/transaction', 
  auth, 
  stocksRateLimit,
  validate(transactionSchema),
  stocksController.executeTransaction
)

router.get('/max-sell/:symbol', 
  auth, 
  stocksRateLimit,
  stocksController.getMaxSellAmount
)

router.get('/transactions', 
  auth, 
  stocksRateLimit,
  stocksController.getTransactionHistory
)

export default router 