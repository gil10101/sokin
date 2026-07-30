/**
 * Stocks Controller
 * 
 * Handles stock market data endpoints using Finnhub API.
 * Provides market indices, trending stocks, search, portfolio management,
 * and transaction execution.
 * 
 * @module controllers/stocksController
 */

import { Request, Response, NextFunction } from 'express'
import { StockData, MarketIndex, UserPortfolioStock, StockTransaction } from '../../types/stocks'
import { db } from '../../config/firebase'
import { Timestamp } from 'firebase-admin/firestore'
import cache, { CACHE_TTL } from '../../utils/cache'
import logger from '../../utils/logger'
import { AppError } from '../../middleware/errorHandler'

import {
  CACHE_DURATIONS,
  STOCK_SYMBOL_PATTERN,
  TRENDING_SYMBOLS,
  MARKET_INDEX_SYMBOLS,
  INDEX_NAME_MAPPING,
  TRADITIONAL_SYMBOL_MAPPING,
  LIMITS,
  AggregatedHolding,
  getOptimizedStockData,
  getFullStockData,
  getMarketIndexQuote,
  searchSymbols,
  processBatchedRequests,
  convertQuoteToMarketIndex,
  createEmptyStockData
} from './finnhubService'

// ============================================================================
// Cache Key Builders
// ============================================================================

/**
 * Build cache key for user portfolio
 */
function buildPortfolioCacheKey(userId: string): string {
  return `portfolio:${userId}`
}

/**
 * Build cache key for transaction history
 */
function buildTransactionHistoryCacheKey(userId: string, limit: number): string {
  return `transactions:${userId}:${limit}`
}

// ============================================================================
// Utility Functions
// ============================================================================

function sanitizeStockSymbol(symbol: string): string {
  if (!symbol || typeof symbol !== 'string') throw new Error('Stock symbol is required')
  const cleaned = symbol.toUpperCase().replace(/[^A-Z0-9^]/g, '')
  if (cleaned.length < 1 || cleaned.length > 10) throw new Error('Stock symbol must be 1-10 characters')
  if (!STOCK_SYMBOL_PATTERN.test(cleaned)) throw new Error('Invalid stock symbol format')
  return cleaned
}

function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') return ''
  return query.replace(/[^a-zA-Z0-9\s\.\-]/g, '')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logSecurityEvent(_req: Request, _action: string, _details: Record<string, unknown> = {}): void {
  // Disabled: too noisy for development
}

function parseLimit(value: unknown, defaultValue: number, min: number, max: number): { valid: true; value: number } | { valid: false; error: string } {
  if (value === undefined || value === null) return { valid: true, value: defaultValue }
  const parsed = parseInt(value as string)
  if (isNaN(parsed)) return { valid: false, error: 'Invalid limit parameter (must be a number)' }
  if (parsed < min || parsed > max) return { valid: false, error: `Invalid limit parameter (must be between ${min} and ${max})` }
  return { valid: true, value: parsed }
}

// ============================================================================
// Portfolio Calculation
// ============================================================================

async function calculateUserPortfolioFromFirebase(userId: string): Promise<UserPortfolioStock[]> {
  if (!db) throw new Error('Firestore not initialized')

  // Order by ascending timestamp to process buys before sells chronologically
  const transactionsSnapshot = await db
    .collection('stockTransactions')
    .where('userId', '==', userId)
    .orderBy('timestamp', 'asc')
    .get()
  
  const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StockTransaction[]
  const holdings = new Map<string, AggregatedHolding>()
  
  for (const tx of transactions) {
    const existing = holdings.get(tx.symbol) || { shares: 0, totalInvested: 0, avgPrice: 0 }
    
    if (tx.transactionType === 'buy') {
      const newShares = existing.shares + tx.shares
      const newTotalInvested = existing.totalInvested + tx.totalAmount
      holdings.set(tx.symbol, { shares: newShares, totalInvested: newTotalInvested, avgPrice: newTotalInvested / newShares })
    } else if (tx.transactionType === 'sell') {
      // Guard against division by zero when processing sells
      if (existing.shares <= 0) {
        logger.warn('Sell transaction with no existing holdings', { symbol: tx.symbol, userId })
        continue
      }
      const newShares = Math.max(0, existing.shares - tx.shares)
      // Clamp proportionSold to prevent negative totalInvested from data inconsistency
      const proportionSold = Math.min(1, tx.shares / existing.shares)
      const newTotalInvested = existing.totalInvested * (1 - proportionSold)
      if (newShares > 0) {
        holdings.set(tx.symbol, { shares: newShares, totalInvested: newTotalInvested, avgPrice: newTotalInvested / newShares })
      } else {
        holdings.delete(tx.symbol)
      }
    }
  }
  
  // Early return if no holdings
  if (holdings.size === 0) {
    return []
  }
  
  // Collect all symbols and their holdings for batch processing
  const holdingsArray = Array.from(holdings.entries())
  const symbols = holdingsArray.map(([symbol]) => symbol)
  
  // Batch fetch all stock data in parallel
  const stockDataResults = await processBatchedRequests<StockData | null>(
    symbols.map(symbol => () => getFullStockData(symbol, false).catch(() => null))
  )
  
  // Create a map of symbol -> stock data for efficient lookup
  const stockDataMap = new Map<string, StockData | null>()
  symbols.forEach((symbol, index) => {
    stockDataMap.set(symbol, stockDataResults[index])
  })
  
  // Build portfolio with fetched stock data
  const portfolioStocks: UserPortfolioStock[] = holdingsArray.map(([symbol, holding]) => {
    const stockData = stockDataMap.get(symbol)
    
    if (stockData && stockData.price > 0) {
      const totalValue = holding.shares * stockData.price
      const gainLoss = totalValue - holding.totalInvested
      const gainLossPercent = holding.totalInvested > 0 ? (gainLoss / holding.totalInvested) * 100 : 0
      
      return {
        symbol: stockData.symbol,
        name: stockData.name,
        price: stockData.price,
        change: stockData.change,
        changePercent: stockData.changePercent,
        shares: holding.shares,
        totalValue,
        purchasePrice: holding.avgPrice,
        gainLoss,
        gainLossPercent
      }
    }
    
    // Fallback when stock data fetch failed
    return {
      symbol,
      name: symbol,
      price: holding.avgPrice,
      change: 0,
      changePercent: 0,
      shares: holding.shares,
      totalValue: holding.shares * holding.avgPrice,
      purchasePrice: holding.avgPrice,
      gainLoss: 0,
      gainLossPercent: 0
    }
  })
  
  return portfolioStocks.sort((a, b) => b.totalValue - a.totalValue)
}

async function saveTransactionToFirebase(transaction: Omit<StockTransaction, 'id'>): Promise<void> {
  if (!db) throw new Error('Firestore not initialized')
  // Always save timestamp as Firestore Timestamp for proper querying and indexing
  const now = Timestamp.now()
  await db.collection('stockTransactions').add({
    ...transaction,
    timestamp: now
  })
}

// ============================================================================
// Controller Endpoints
// ============================================================================

async function getMarketIndices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const indices: MarketIndex[] = []
    const quotes = await Promise.all(MARKET_INDEX_SYMBOLS.map(s => getMarketIndexQuote(s).catch(() => null)))
    
    for (let i = 0; i < MARKET_INDEX_SYMBOLS.length; i++) {
      const symbol = MARKET_INDEX_SYMBOLS[i]
      const quote = quotes[i]
      if (quote && quote.c > 0) {
        indices.push(convertQuoteToMarketIndex(quote, INDEX_NAME_MAPPING[symbol], TRADITIONAL_SYMBOL_MAPPING[symbol]))
      }
    }

    if (indices.length === MARKET_INDEX_SYMBOLS.length) {
      res.json({ success: true, data: indices })
    } else {
      throw new Error('Some indices missing from Finnhub response')
    }
  } catch (error) {
    logger.error('Failed to fetch market indices', { error: error instanceof Error ? error.message : 'Unknown' })
    next(new AppError('Failed to fetch market indices', 500, false))
  }
}

async function getTrendingStocks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limitResult = parseLimit(req.query.limit, LIMITS.DEFAULT_TRENDING, 1, LIMITS.MAX_TRENDING)
    if (!limitResult.valid) throw new AppError(limitResult.error, 400, true)

    const cacheKey = `trending_stocks:${limitResult.value}`
    
    // Try distributed cache first
    const cached = await cache.getAsync<StockData[]>(cacheKey)
    if (cached) { res.json({ success: true, data: cached }); return }

    const symbolsToFetch = TRENDING_SYMBOLS.slice(0, limitResult.value)
    const results = await processBatchedRequests(symbolsToFetch.map(s => () => getOptimizedStockData(s)))
    const validStocks = results.filter((s): s is StockData => s !== null)

    if (validStocks.length > 0) {
      await cache.setAsync(cacheKey, validStocks, CACHE_DURATIONS.TRENDING)
      res.json({ success: true, data: validStocks })
    } else {
      throw new Error('No trending stocks data available')
    }
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to fetch trending stocks', { error: error instanceof Error ? error.message : 'Unknown' })
    next(new AppError('Failed to fetch trending stocks', 500, false))
  }
}

async function searchStocksHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q } = req.query
    if (!q || typeof q !== 'string') throw new AppError('Search query is required', 400, true)
    if (q.length < 1 || q.length > 50) throw new AppError('Search query must be between 1 and 50 characters', 400, true)

    const sanitizedQuery = sanitizeSearchQuery(q)
    if (!sanitizedQuery.length) throw new AppError('Invalid search query format', 400, true)

    const limitResult = parseLimit(req.query.limit, LIMITS.DEFAULT_SEARCH, 1, LIMITS.MAX_SEARCH)
    if (!limitResult.valid) throw new AppError(limitResult.error, 400, true)

    const searchResult = await searchSymbols(sanitizedQuery)
    
    if (searchResult?.result?.length > 0) {
      const usStocks = searchResult.result.filter(item => item.type === 'Common Stock' && !item.symbol.includes('.')).slice(0, limitResult.value)
      
      if (usStocks.length > 0) {
        const results = await processBatchedRequests(usStocks.map(stock => 
          () => getOptimizedStockData(stock.symbol).catch(() => createEmptyStockData(stock.symbol, stock.description))
        ))
        const validResults = results.filter(s => s && s.price > 0)
        res.json({ success: true, data: validResults })
        return
      }
    }
    // Return empty array for no results - this is a valid outcome, not an error
    res.json({ success: true, data: [] })
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Stock search failed', { error: error instanceof Error ? error.message : 'Unknown' })
    next(new AppError('Stock search failed', 500, false))
  }
}

async function getStockData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { symbol } = req.params
    if (!symbol || !STOCK_SYMBOL_PATTERN.test(symbol.toUpperCase())) {
      throw new AppError('Invalid stock symbol format', 400, true)
    }
    const stock = await getFullStockData(symbol.toUpperCase(), true)
    res.json({ success: true, data: stock })
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to fetch stock data', { symbol: req.params.symbol, error: error instanceof Error ? error.message : 'Unknown' })
    next(new AppError(`Failed to fetch data for ${req.params.symbol}`, 500, false))
  }
}

async function getUserPortfolio(req: Request, res: Response, next: NextFunction): Promise<void> {
  // userId is derived from authenticated user's token - prevents IDOR vulnerabilities
  const userId = req.user?.uid
  try {
    if (!userId) throw new AppError('Unauthorized: User ID missing', 401, true)

    const cacheKey = buildPortfolioCacheKey(userId)
    
    // Try distributed cache first with short TTL for portfolio
    const cachedPortfolio = await cache.getAsync<{ success: boolean; data: UserPortfolioStock[] }>(cacheKey)
    if (cachedPortfolio) {
      logSecurityEvent(req, 'PORTFOLIO_ACCESS_SUCCESS', { userId, cached: true })
      res.json(cachedPortfolio)
      return
    }
    
    logSecurityEvent(req, 'PORTFOLIO_ACCESS_SUCCESS', { userId, cached: false })
    const portfolio = await calculateUserPortfolioFromFirebase(userId)
    
    const result = { success: true, data: portfolio }
    
    // Cache portfolio for short duration (prices update frequently)
    await cache.setAsync(cacheKey, result, CACHE_TTL.PORTFOLIO)
    
    res.json(result)
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to fetch user portfolio', { userId, error: error instanceof Error ? error.message : 'Unknown' })
    logSecurityEvent(req, 'PORTFOLIO_ACCESS_FAILED', { userId, error: error instanceof Error ? error.message : 'Unknown' })
    next(new AppError('Failed to fetch user portfolio', 500, false))
  }
}

async function executeTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { symbol, type, amount, price } = req.body
    const userId = req.user?.uid
    
    if (!userId) throw new AppError('Authentication required', 401, true)
    if (!symbol || !type || !amount || !price) throw new AppError('Missing required fields: symbol, type, amount, price', 400, true)
    if (type !== 'buy' && type !== 'sell') throw new AppError('Transaction type must be buy or sell', 400, true)

    const numericAmount = parseFloat(amount), numericPrice = parseFloat(price)
    if (isNaN(numericAmount) || numericAmount <= 0) throw new AppError('Amount must be a positive number', 400, true)
    if (isNaN(numericPrice) || numericPrice <= 0) throw new AppError('Price must be a positive number', 400, true)

    const shares = Math.floor(numericAmount / numericPrice * 100) / 100
    if (shares <= 0) throw new AppError('Transaction amount is too small to purchase any shares', 400, true)

    const sanitizedSymbol = sanitizeStockSymbol(symbol)
    
    const now = Timestamp.now()
    const nowISO = new Date().toISOString()
    
    if (type === 'sell') {
      // Use Firestore transaction to prevent TOCTOU race condition
      // Read holdings using transaction.get() so the read is part of the transaction
      if (!db) throw new Error('Firestore not initialized')
      await db.runTransaction(async (firestoreTransaction) => {
        // Read transactions for this symbol using the transaction object
        const txQuery = db!.collection('stockTransactions')
          .where('userId', '==', userId)
          .where('symbol', '==', sanitizedSymbol)
          .orderBy('timestamp', 'asc')
        const txSnapshot = await firestoreTransaction.get(txQuery)

        // Calculate holdings for this symbol
        let shares_held = 0
        for (const doc of txSnapshot.docs) {
          const data = doc.data()
          if (data.transactionType === 'buy') {
            shares_held += data.shares
          } else if (data.transactionType === 'sell') {
            shares_held -= data.shares
          }
        }

        if (shares_held <= 0) throw new Error(`Cannot sell ${sanitizedSymbol} - you don't own any shares`)
        if (shares_held < shares) throw new Error(`Cannot sell ${shares} shares of ${sanitizedSymbol} - you only own ${shares_held} shares`)

        const txRef = db!.collection('stockTransactions').doc()
        firestoreTransaction.set(txRef, {
          userId, symbol: sanitizedSymbol, transactionType: type, shares,
          pricePerShare: numericPrice, totalAmount: shares * numericPrice,
          transactionDate: nowISO, createdAt: nowISO, timestamp: now
        })
      })
    } else {
    await saveTransactionToFirebase({
      userId, symbol: sanitizedSymbol, transactionType: type, shares,
      pricePerShare: numericPrice, totalAmount: shares * numericPrice,
      transactionDate: nowISO, createdAt: nowISO
    })
    }
    
    // Invalidate portfolio and transaction history caches
    await Promise.all([
      cache.invalidatePatternAsync(`portfolio:${userId}*`),
      cache.invalidatePatternAsync(`transactions:${userId}:*`)
    ])
    
    logSecurityEvent(req, 'TRANSACTION_EXECUTED', { symbol: sanitizedSymbol, type, amount: numericAmount, shares, price: numericPrice })
    res.json({
      success: true,
      message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${shares} shares of ${sanitizedSymbol}`,
      data: { symbol: sanitizedSymbol, type, shares, price: numericPrice, totalValue: shares * numericPrice }
    })
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Transaction failed', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined })

    // Return validation errors with 400 status, server errors with 500
    if (errorMessage.includes('don\'t own') || errorMessage.includes('only own') || errorMessage.includes('Invalid')) {
      next(new AppError(errorMessage, 400, true))
    } else {
      next(new AppError('Transaction failed', 500, false))
    }
  }
}

async function getMaxSellAmount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { symbol } = req.params
    const userId = req.user?.uid
    
    if (!userId) throw new AppError('Authentication required', 401, true)
    if (!symbol) throw new AppError('Stock symbol is required', 400, true)

    const sanitizedSymbol = sanitizeStockSymbol(symbol)

    const portfolio = await calculateUserPortfolioFromFirebase(userId)
    const holding = portfolio.find(s => s.symbol === sanitizedSymbol)
    
    if (!holding) { res.json({ success: true, data: { shares: 0, value: 0, price: 0 } }); return }
    
    try {
      const stockData = await getFullStockData(sanitizedSymbol, false)
      res.json({ success: true, data: { shares: holding.shares, value: holding.shares * stockData.price, price: stockData.price } })
    } catch {
      res.json({ success: true, data: { shares: holding.shares, value: holding.shares * holding.purchasePrice, price: holding.purchasePrice } })
    }
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to get max sell amount', { error: error instanceof Error ? error.message : 'Unknown' })
    next(new AppError('Failed to get maximum sell amount', 500, false))
  }
}

async function getTransactionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.uid
    if (!userId) throw new AppError('Authentication required', 401, true)

    const limitResult = parseLimit(req.query.limit, LIMITS.DEFAULT_TRANSACTION_HISTORY, 1, LIMITS.MAX_TRANSACTION_HISTORY)
    if (!limitResult.valid) throw new AppError(limitResult.error, 400, true)

    const cacheKey = buildTransactionHistoryCacheKey(userId, limitResult.value)
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: StockTransaction[] }>(cacheKey)
    if (cachedResult) {
      res.json(cachedResult)
      return
    }

    if (!db) throw new Error('Firestore not initialized')
    
    const snapshot = await db.collection('stockTransactions')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limitResult.value)
      .get()
    
    // Normalize all timestamps to ISO strings for consistent client-side parsing
    const transactions = snapshot.docs.map(doc => {
      const data = doc.data()
      let timestamp: string | null = null
      
      // Handle Firestore Timestamp, Date, or string timestamps
      // Priority: timestamp field > createdAt > transactionDate
      const timestampField = data.timestamp || data.createdAt || data.transactionDate
      
      if (timestampField) {
        if (typeof timestampField.toDate === 'function') {
          // Firestore Timestamp
          timestamp = timestampField.toDate().toISOString()
        } else if (timestampField instanceof Date) {
          timestamp = timestampField.toISOString()
        } else if (typeof timestampField === 'string') {
          // Validate and pass through valid ISO strings
          const parsed = new Date(timestampField)
          timestamp = isNaN(parsed.getTime()) ? null : parsed.toISOString()
        }
      }
      
      return { id: doc.id, ...data, timestamp }
    })
    
    const result = { success: true, data: transactions }
    
    // Cache transaction history
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY)
    
    res.json(result)
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to get transaction history', { error: error instanceof Error ? error.message : 'Unknown' })
    next(new AppError('Failed to get transaction history', 500, false))
  }
}

// ============================================================================
// Watchlist Management
// ============================================================================

/**
 * Build cache key for user watchlist
 */
function buildWatchlistCacheKey(userId: string): string {
  return `watchlist:${userId}`
}

/**
 * Get user's watchlist
 */
async function getUserWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.uid
    if (!userId) throw new AppError('Authentication required', 401, true)

    const cacheKey = buildWatchlistCacheKey(userId)
    
    // Try distributed cache first
    const cachedWatchlist = await cache.getAsync<{ symbols: string[] }>(cacheKey)
    if (cachedWatchlist) {
      res.json({ success: true, data: { symbols: cachedWatchlist.symbols || [] } })
      return
    }

    if (!db) throw new Error('Firestore not initialized')

    // Fetch watchlist from Firestore
    const watchlistDoc = await db.collection('watchlists').doc(userId).get()
    
    let symbols: string[] = []
    if (watchlistDoc.exists) {
      const data = watchlistDoc.data()
      symbols = (data?.symbols || []) as string[]
    } else {
      // Create empty watchlist document for new users
      await db.collection('watchlists').doc(userId).set({ userId, symbols: [], updatedAt: new Date().toISOString() })
    }

    const result = { success: true, data: { symbols } }
    
    // Cache watchlist (cache with the structure that matches response)
    await cache.setAsync(cacheKey, { symbols }, CACHE_TTL.LIST_QUERY)

    res.json(result)
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to get user watchlist', {
      userId: req.user?.uid,
      error: error instanceof Error ? error.message : 'Unknown'
    })
    next(new AppError('Failed to get user watchlist', 500, false))
  }
}

/**
 * Add symbol to watchlist
 */
async function addToWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.uid
    if (!userId) throw new AppError('Authentication required', 401, true)

    const { symbol } = req.body
    if (!symbol || typeof symbol !== 'string') throw new AppError('Symbol is required', 400, true)

    const sanitizedSymbol = sanitizeStockSymbol(symbol)

    if (!db) throw new Error('Firestore not initialized')

    // Use Firestore transaction to ensure atomic update
    await db.runTransaction(async (transaction) => {
      const watchlistRef = db!.collection('watchlists').doc(userId)
      const watchlistDoc = await transaction.get(watchlistRef)
      
      let symbols: string[] = []
      if (watchlistDoc.exists) {
        const data = watchlistDoc.data()
        symbols = (data?.symbols || []) as string[]
      }

      // Only add if not already in watchlist
      if (!symbols.includes(sanitizedSymbol)) {
        symbols.push(sanitizedSymbol)
        transaction.set(watchlistRef, {
          userId,
          symbols,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      }
    })

    // Invalidate cache
    await cache.delAsync(buildWatchlistCacheKey(userId))

    logSecurityEvent(req, 'WATCHLIST_UPDATED', { userId, action: 'add', symbol: sanitizedSymbol })
    res.json({ success: true, message: `Added ${sanitizedSymbol} to watchlist` })
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to add to watchlist', {
      userId: req.user?.uid,
      error: error instanceof Error ? error.message : 'Unknown'
    })
    next(new AppError('Failed to add to watchlist', 500, false))
  }
}

/**
 * Remove symbol from watchlist
 */
async function removeFromWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.uid
    if (!userId) throw new AppError('Authentication required', 401, true)

    const { symbol } = req.params
    if (!symbol) throw new AppError('Symbol is required', 400, true)

    const sanitizedSymbol = sanitizeStockSymbol(symbol)

    if (!db) throw new Error('Firestore not initialized')

    // Use Firestore transaction to ensure atomic update
    await db.runTransaction(async (transaction) => {
      const watchlistRef = db!.collection('watchlists').doc(userId)
      const watchlistDoc = await transaction.get(watchlistRef)
      
      if (!watchlistDoc.exists) {
        return // Nothing to remove
      }

      const data = watchlistDoc.data()
      const symbols = ((data?.symbols || []) as string[]).filter(s => s !== sanitizedSymbol)
      
      transaction.set(watchlistRef, {
        userId,
        symbols,
        updatedAt: new Date().toISOString()
      }, { merge: true })
    })

    // Invalidate cache
    await cache.delAsync(buildWatchlistCacheKey(userId))

    logSecurityEvent(req, 'WATCHLIST_UPDATED', { userId, action: 'remove', symbol: sanitizedSymbol })
    res.json({ success: true, message: `Removed ${sanitizedSymbol} from watchlist` })
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to remove from watchlist', {
      userId: req.user?.uid,
      error: error instanceof Error ? error.message : 'Unknown'
    })
    next(new AppError('Failed to remove from watchlist', 500, false))
  }
}

/**
 * Update entire watchlist
 */
async function updateWatchlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.uid
    if (!userId) throw new AppError('Authentication required', 401, true)

    const { symbols } = req.body
    if (!Array.isArray(symbols)) throw new AppError('Symbols must be an array', 400, true)

    // Validate and sanitize all symbols
    const sanitizedSymbols: string[] = []
    for (const symbol of symbols) {
      sanitizedSymbols.push(sanitizeStockSymbol(symbol))
    }

    // Remove duplicates
    const uniqueSymbols = [...new Set(sanitizedSymbols)]

    if (!db) throw new Error('Firestore not initialized')

    // Update watchlist
    await db.collection('watchlists').doc(userId).set({
      userId,
      symbols: uniqueSymbols,
      updatedAt: new Date().toISOString()
    }, { merge: true })

    // Invalidate cache
    await cache.delAsync(buildWatchlistCacheKey(userId))

    logSecurityEvent(req, 'WATCHLIST_UPDATED', { userId, action: 'update', count: uniqueSymbols.length })
    res.json({ success: true, message: 'Watchlist updated successfully' })
  } catch (error) {
    if (error instanceof AppError) { next(error); return }
    logger.error('Failed to update watchlist', {
      userId: req.user?.uid,
      error: error instanceof Error ? error.message : 'Unknown'
    })
    next(new AppError('Failed to update watchlist', 500, false))
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  getMarketIndices,
  getTrendingStocks,
  searchStocks: searchStocksHandler,
  getStockData,
  getUserPortfolio,
  executeTransaction,
  getMaxSellAmount,
  getTransactionHistory,
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlist
}
