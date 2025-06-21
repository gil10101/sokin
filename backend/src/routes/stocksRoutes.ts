import { Router } from 'express'
import stocksController from '../controllers/stocksController'
import { auth } from '../middleware/auth'
import { validate } from '../middleware/validation'
import { rateLimiter } from '../middleware/rateLimiter'
import { z } from 'zod'

const router = Router()

// Rate limiting for stock API calls (more lenient than other endpoints)
const stocksRateLimit = rateLimiter(30, 60 * 1000) // 30 requests per minute

// Validation schemas
const searchStocksSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(20),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 10)
  })
})

const stockSymbolSchema = z.object({
  params: z.object({
    symbol: z.string().min(1).max(10).regex(/^[A-Z^]+$/, 'Invalid stock symbol format')
  })
})

const userIdSchema = z.object({
  params: z.object({
    userId: z.string().min(1)
  })
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

export default router 