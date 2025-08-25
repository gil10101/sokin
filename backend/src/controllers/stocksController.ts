import { Request, Response } from 'express'
import { StockData, MarketIndex, UserPortfolioStock, StockTransaction, StockHolding } from '../types/stocks'
import https from 'https'
import http from 'http'
import { db } from '../config/firebase'
import cache from '../utils/cache'

// Finnhub API configuration
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd2lo1khr01qr27gk695gd2lo1khr01qr27gk6960'
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

// Python yfinance service configuration (fallback)
const PYTHON_STOCK_SERVICE_URL = process.env.PYTHON_STOCK_SERVICE_URL || 'http://localhost:5000'

// Cache durations for different data types (in seconds)
const CACHE_DURATIONS = {
  QUOTE: 30,           // Stock quotes - 30 seconds (aggressive caching for quotes)
  PROFILE: 3600,       // Company profiles - 1 hour (rarely changes)
  SEARCH: 300,         // Search results - 5 minutes
  TRENDING: 60,        // Trending stocks - 1 minute
  MARKET_INDICES: 30,  // Market indices - 30 seconds
  CANDLES: 300,        // Historical data - 5 minutes
}

// Request batching to reduce concurrent API calls
const REQUEST_BATCH_SIZE = 5  // Maximum concurrent requests to Finnhub

/**
 * Finnhub API response interfaces
 */
interface FinnhubQuote {
  c: number  // Current price
  h: number  // High price of the day
  l: number  // Low price of the day
  o: number  // Open price of the day
  pc: number // Previous close price
  t: number  // Timestamp
}

interface FinnhubProfile {
  name: string
  ticker: string
  marketCapitalization: number
  finnhubIndustry: string
  weburl: string
  logo: string
  phone: string
  exchange: string
  ipo: string
  country: string
  currency: string
}

interface FinnhubCandle {
  o: number[]  // Open prices
  h: number[]  // High prices
  l: number[]  // Low prices
  c: number[]  // Close prices
  v: number[]  // Volume
  t: number[]  // Timestamps
  s: string    // Status
}

interface FinnhubSymbolLookup {
  count: number
  result: Array<{
    description: string
    displaySymbol: string
    symbol: string
    type: string
  }>
}

/**
 * StocksController handles all stock-related API endpoints
 * Uses Finnhub API as primary data source with yfinance service as fallback
 * 
 * @example
 * ```typescript
 * // Usage in routes
 * router.get('/stock/:symbol', stocksController.getStockData)
 * ```
 */
class StocksController {
  /**
   * Helper method to call Finnhub API with aggressive caching and rate limiting
   * 
   * @template T - The expected response type
   * @param endpoint - The API endpoint to call (e.g., '/quote?symbol=AAPL')
   * @param cacheDuration - Optional cache duration in seconds
   * @returns Promise with the parsed response data
   * 
   * @throws {Error} When Finnhub API is unavailable
   * @throws {Error} When response parsing fails
   * @throws {Error} When API key is missing
   * 
   * @example
   * ```typescript
   * const quote = await this.callFinnhubAPI<FinnhubQuote>('/quote?symbol=AAPL', CACHE_DURATIONS.QUOTE)
   * ```
   */
  private async callFinnhubAPI<T>(endpoint: string, cacheDuration?: number): Promise<T> {
    if (!FINNHUB_API_KEY) {
      throw new Error('Finnhub API key not configured')
    }

    // Create a cache key from the endpoint
    const cacheKey = `finnhub:${endpoint}`
    
    // Check cache first
    const cachedData = cache.get<T>(cacheKey)
    if (cachedData) {
      console.log(`Cache hit for Finnhub endpoint: ${endpoint}`)
      return cachedData
    }

    console.log(`Cache miss - calling Finnhub API: ${endpoint}`)

    return new Promise((resolve, reject) => {
      const url = `${FINNHUB_BASE_URL}${endpoint}&token=${FINNHUB_API_KEY}`
      
      const options = {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Sokin-Backend/1.0',
        },
        timeout: 10000, // 10 second timeout
      }
      
      const request = https.get(url, options, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              const errorMsg = `Finnhub API error: ${res.statusCode} - ${res.statusMessage}`
              console.error(errorMsg)
              reject(new Error(errorMsg))
              return
            }
            
            const jsonData = JSON.parse(data)
            
            // Check for Finnhub API error responses
            if (jsonData.error) {
              console.error(`Finnhub API error: ${jsonData.error}`)
              reject(new Error(`Finnhub API error: ${jsonData.error}`))
              return
            }
            
            // Cache the successful response
            if (cacheDuration) {
              cache.set(cacheKey, jsonData, cacheDuration)
              console.log(`Cached Finnhub response for ${cacheDuration}s: ${endpoint}`)
            }
            
            console.log(`Finnhub API response received successfully`)
            resolve(jsonData)
          } catch (error) {
            console.error(`Failed to parse Finnhub API response:`, error)
            reject(new Error('Invalid response from Finnhub API'))
          }
        })
      })
      
      request.on('error', (error) => {
        console.error(`Finnhub API call failed:`, error)
        reject(new Error('Finnhub API unavailable'))
      })
      
      request.on('timeout', () => {
        console.error('Finnhub API request timeout')
        request.destroy()
        reject(new Error('Finnhub API timeout'))
      })
    })
  }

  /**
   * Process requests in batches to avoid overwhelming Finnhub API
   * 
   * @template T - The expected response type
   * @param requests - Array of request functions
   * @param batchSize - Number of concurrent requests
   * @returns Promise resolving to array of results
   */
  private async processBatchedRequests<T>(
    requests: (() => Promise<T>)[],
    batchSize: number = REQUEST_BATCH_SIZE
  ): Promise<T[]> {
    const results: T[] = []
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(requests.length / batchSize)} (${batch.length} requests)`)
      
      const batchResults = await Promise.allSettled(batch.map(request => request()))
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        }
      }
      
      // Add small delay between batches to be respectful to the API
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return results
  }

  /**
   * Helper method to securely call Python yfinance service (fallback)
   * Forwards authentication headers and implements timeout handling
   * 
   * @template T - The expected response type
   * @param endpoint - The API endpoint to call (e.g., '/api/stock/AAPL')
   * @param req - Express request object for forwarding auth headers
   * @returns Promise with the parsed response data
   * 
   * @throws {Error} When Python service is unavailable
   * @throws {Error} When response parsing fails
   * @throws {Error} When authentication fails
   * 
   * @example
   * ```typescript
   * const stockData = await this.callPythonService<StockData>('/api/stock/AAPL', req)
   * ```
   */
  private async callPythonService<T>(endpoint: string, req?: Request): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = `${PYTHON_STOCK_SERVICE_URL}${endpoint}`
      console.log(`Calling Python service: ${url}`)
      
      const client = url.startsWith('https') ? https : http
      
      // Set up headers with proper security
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sokin-Backend/1.0',
      }
      
      // Forward Authorization header if available (for authenticated endpoints)
      if (req?.headers.authorization) {
        headers.Authorization = req.headers.authorization
      }
      
      const options = {
        headers,
        timeout: 30000, // 30 second timeout
      }
      
      const request = client.get(url, options, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              const errorMsg = `Python service error: ${res.statusCode} - ${res.statusMessage}`
              console.error(errorMsg)
              reject(new Error(errorMsg))
              return
            }
            
            const jsonData = JSON.parse(data)
            console.log(`Python service response received successfully`)
            resolve(jsonData)
          } catch (error) {
            console.error(`Failed to parse Python service response:`, error)
            reject(new Error('Invalid response from stock service'))
          }
        })
      })
      
      request.on('error', (error) => {
        console.error(`Python service call failed:`, error)
        reject(new Error('Stock service unavailable'))
      })
      
      request.on('timeout', () => {
        console.error('Python service request timeout')
        request.destroy()
        reject(new Error('Stock service timeout'))
      })
    })
  }

  /**
   * Convert Finnhub quote and profile data to our StockData format
   * 
   * @param symbol - Stock symbol
   * @param quote - Finnhub quote data
   * @param profile - Finnhub company profile (optional)
   * @param candles - Historical candle data for volume and 52-week data (optional)
   * @returns Converted StockData object
   */
  private convertFinnhubToStockData(
    symbol: string, 
    quote: FinnhubQuote, 
    profile?: FinnhubProfile,
    candles?: FinnhubCandle
  ): StockData {
    const change = quote.c - quote.pc
    const changePercent = quote.pc !== 0 ? (change / quote.pc) * 100 : 0

    // Calculate 52-week high/low and volume from candles if available
    let weekHigh52 = quote.h
    let weekLow52 = quote.l
    let volume = 0
    let avgVolume = 0
    let weekChange52 = 0
    let chart: number[] = []

    if (candles && candles.s === 'ok' && candles.c.length > 0) {
      weekHigh52 = Math.max(...candles.h)
      weekLow52 = Math.min(...candles.l)
      volume = candles.v[candles.v.length - 1] || 0
      avgVolume = candles.v.reduce((sum, v) => sum + v, 0) / candles.v.length

      // Calculate 52-week change
      const yearAgoPrice = candles.c[0]
      if (yearAgoPrice && yearAgoPrice > 0) {
        weekChange52 = ((quote.c - yearAgoPrice) / yearAgoPrice) * 100
      }

      // Create chart data (last 30 data points)
      chart = candles.c.slice(-30)
    }

    return {
      symbol: symbol.toUpperCase(),
      name: profile?.name || symbol.toUpperCase(),
      price: Number(quote.c.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      volume,
      avgVolume: Math.round(avgVolume),
      marketCap: 'N/A', // Removed to reduce API requests
      peRatio: null, // Finnhub doesn't provide P/E in basic quote
      weekHigh52: Number(weekHigh52.toFixed(2)),
      weekLow52: Number(weekLow52.toFixed(2)),
      weekChange52: Number(weekChange52.toFixed(2)),
      chart
    }
  }

  /**
   * Get optimized stock data without historical data for trending stocks
   * This method reduces API calls by only fetching quote and profile data
   * 
   * @param symbol - Stock symbol
   * @returns Promise resolving to StockData
   */
  private async getOptimizedStockData(symbol: string): Promise<StockData | null> {
    try {
      console.log(`Fetching optimized ${symbol} data from Finnhub...`)
      
      const [quote, profile] = await Promise.allSettled([
        this.callFinnhubAPI<FinnhubQuote>(`/quote?symbol=${symbol}`, CACHE_DURATIONS.QUOTE),
        this.callFinnhubAPI<FinnhubProfile>(`/stock/profile2?symbol=${symbol}`, CACHE_DURATIONS.PROFILE)
      ])

      if (quote.status === 'fulfilled' && quote.value && quote.value.c > 0) {
        const profileData = profile.status === 'fulfilled' ? profile.value : undefined
        return this.convertFinnhubToStockData(symbol, quote.value, profileData)
      }

      throw new Error('Invalid Finnhub response or no data available')

    } catch (finnhubError) {
      console.warn(`Finnhub failed for ${symbol}, falling back to yfinance:`, finnhubError)
      
      // Fallback to yfinance service
      try {
        const stockData = await this.callPythonService<StockData>(`/api/stock/${symbol}`)
        console.log(`Successfully fetched ${symbol} from yfinance fallback`)
        return stockData
      } catch (yfinanceError) {
        console.error(`Both Finnhub and yfinance failed for ${symbol}:`, yfinanceError)
        return null
      }
    }
  }

  /**
   * Get stock data from Finnhub with fallback to yfinance
   * 
   * @param symbol - Stock symbol
   * @param includeHistorical - Whether to include historical data for 52-week calculations
   * @returns Promise resolving to StockData
   */
  private async getStockDataWithFallback(symbol: string, includeHistorical = true): Promise<StockData> {
    try {
      // Try Finnhub first
      console.log(`Fetching ${symbol} data from Finnhub...`)
      
      const [quote, profile] = await Promise.allSettled([
        this.callFinnhubAPI<FinnhubQuote>(`/quote?symbol=${symbol}`, CACHE_DURATIONS.QUOTE),
        this.callFinnhubAPI<FinnhubProfile>(`/stock/profile2?symbol=${symbol}`, CACHE_DURATIONS.PROFILE)
      ])

      if (quote.status === 'fulfilled' && quote.value && quote.value.c > 0) {
        let candles: FinnhubCandle | undefined

        // Get historical data for better metrics if requested
        if (includeHistorical) {
          try {
            const toTimestamp = Math.floor(Date.now() / 1000)
            const fromTimestamp = toTimestamp - (365 * 24 * 60 * 60) // 1 year ago
            
            const candleResult = await this.callFinnhubAPI<FinnhubCandle>(
              `/stock/candle?symbol=${symbol}&resolution=D&from=${fromTimestamp}&to=${toTimestamp}`,
              CACHE_DURATIONS.CANDLES
            )
            
            if (candleResult.s === 'ok') {
              candles = candleResult
            }
          } catch (candleError) {
            console.warn(`Failed to get historical data for ${symbol} from Finnhub:`, candleError)
          }
        }

        const profileData = profile.status === 'fulfilled' ? profile.value : undefined
        return this.convertFinnhubToStockData(symbol, quote.value, profileData, candles)
      }

      throw new Error('Invalid Finnhub response or no data available')

    } catch (finnhubError) {
      console.warn(`Finnhub failed for ${symbol}, falling back to yfinance:`, finnhubError)
      
      // Fallback to yfinance service
      try {
        const stockData = await this.callPythonService<StockData>(`/api/stock/${symbol}`)
        console.log(`Successfully fetched ${symbol} from yfinance fallback`)
        return stockData
      } catch (yfinanceError) {
        console.error(`Both Finnhub and yfinance failed for ${symbol}:`, yfinanceError)
        throw new Error(`Failed to fetch stock data for ${symbol} from both APIs`)
      }
    }
  }

  /**
   * Get market indices (NASDAQ, S&P 500, Dow Jones)
   * Uses Finnhub API with fallback to yfinance service
   * Public endpoint - no authentication required
   * 
   * @param req - Express request object
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with market indices data
   * 
   * @example
   * Response format:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "^GSPC",
   *       "name": "S&P 500",
   *       "price": 4500.23,
   *       "change": 15.67,
   *       "changePercent": 0.35
   *     }
   *   ]
   * }
   * ```
   */
  async getMarketIndices(req: Request, res: Response): Promise<void> {
    try {
      // Major market indices ETF symbols for Finnhub (these are definitely supported)
      const symbols = ['SPY', 'DIA', 'QQQ'] // SPDR S&P 500, SPDR Dow Jones, Invesco QQQ (NASDAQ)
      const indices: MarketIndex[] = []

      try {
        // Try Finnhub first
        console.log('Fetching market indices from Finnhub...')
        
        const quotePromises = symbols.map(symbol => 
          this.callFinnhubAPI<FinnhubQuote>(`/quote?symbol=${symbol}`, CACHE_DURATIONS.MARKET_INDICES)
            .catch(error => {
              console.warn(`Failed to get ${symbol} from Finnhub:`, error)
              return null
            })
        )

        const quotes = await Promise.all(quotePromises)
        
        for (let i = 0; i < symbols.length; i++) {
          const symbol = symbols[i]
          const quote = quotes[i]
          
          if (quote && quote.c > 0) {
            const change = quote.c - quote.pc
            const changePercent = quote.pc !== 0 ? (change / quote.pc) * 100 : 0
            
            // Map ETF symbols to readable index names
            const nameMapping: Record<string, string> = {
              'SPY': 'S&P 500',
              'DIA': 'Dow Jones Industrial Average',
              'QQQ': 'NASDAQ Composite'
            }
            
            // Map to traditional index symbols for consistency
            const traditionalSymbols: Record<string, string> = {
              'SPY': '^GSPC',
              'DIA': '^DJI',
              'QQQ': '^IXIC'
            }
            
            indices.push({
              symbol: traditionalSymbols[symbol] || symbol,
              name: nameMapping[symbol] || symbol,
              price: Number(quote.c.toFixed(2)),
              change: Number(change.toFixed(2)),
              changePercent: Number(changePercent.toFixed(2))
            })
          }
        }

        if (indices.length === symbols.length) {
          console.log('Successfully fetched all market indices from Finnhub')
          res.json({
            success: true,
            data: indices,
          })
          return
        }

        throw new Error('Some indices missing from Finnhub response')

      } catch (finnhubError) {
        console.warn('Finnhub failed for market indices, falling back to yfinance:', finnhubError)
        
        // Fallback to yfinance service
        const indicesFromYfinance = await this.callPythonService<MarketIndex[]>('/api/market-indices', req)
        
        res.json({
          success: true,
          data: indicesFromYfinance,
        })
      }
    } catch (error) {
      console.error('Error fetching market indices from both APIs:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market indices'
      })
    }
  }

  /**
   * Get trending stocks based on popular symbols
   * Uses predefined list of popular stocks with Finnhub data, fallback to yfinance
   * Public endpoint with optional limit parameter
   * 
   * @param req - Express request object
   * @param req.query.limit - Optional limit for number of results (default: 10, max: 50)
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with trending stocks
   * 
   * @example
   * GET /api/trending?limit=5
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "AAPL",
   *       "name": "Apple Inc.",
   *       "price": 175.50,
   *       "change": 2.30,
   *       "changePercent": 1.33,
   *       "volume": 45000000
   *     }
   *   ]
   * }
   * ```
   */
  async getTrendingStocks(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query
      
      // Input validation
      const parsedLimit = parseInt(limit as string)
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter (must be between 1 and 50)'
        })
        return
      }

      try {
        // Check cache for trending stocks first
        const trendingCacheKey = `trending_stocks:${parsedLimit}`
        const cachedTrending = cache.get<StockData[]>(trendingCacheKey)
        
        if (cachedTrending) {
          console.log(`Cache hit for trending stocks (${parsedLimit} items)`)
          res.json({
            success: true,
            data: cachedTrending,
          })
          return
        }

        // Popular trending stocks list
        const trendingSymbols = [
          'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'ORCL',
          'BABA', 'V', 'MA', 'JPM', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'DIS'
        ]

        // Limit symbols to requested amount
        const symbolsToFetch = trendingSymbols.slice(0, parsedLimit)
        
        console.log(`Fetching trending stocks from Finnhub for ${symbolsToFetch.length} symbols...`)
        
        // Create request functions for batching
        const requestFunctions = symbolsToFetch.map(symbol => 
          () => this.getOptimizedStockData(symbol)
        )

        // Process requests in batches to avoid overwhelming the API
        const stockResults = await this.processBatchedRequests(requestFunctions)
        const validStocks = stockResults.filter((stock): stock is StockData => stock !== null)

        if (validStocks.length > 0) {
          // Cache the successful result
          cache.set(trendingCacheKey, validStocks, CACHE_DURATIONS.TRENDING)
          
          console.log(`Successfully fetched ${validStocks.length} trending stocks`)
          res.json({
            success: true,
            data: validStocks,
          })
          return
        }

        throw new Error('No trending stocks data available from Finnhub')

      } catch (finnhubError) {
        console.warn('Finnhub failed for trending stocks, falling back to yfinance:', finnhubError)
        
        // Fallback to yfinance service
        const stocks = await this.callPythonService<StockData[]>(`/api/trending-stocks?limit=${parsedLimit}`, req)
        
        res.json({
          success: true,
          data: stocks,
        })
      }
    } catch (error) {
      console.error('Error fetching trending stocks from both APIs:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending stocks'
      })
    }
  }

  /**
   * Get user's stock portfolio with real-time prices
   * Protected endpoint - requires authentication
   * 
   * @param req - Express request object
   * @param req.params.userId - User ID to fetch portfolio for
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with user portfolio
   * 
   * @security
   * - Requires valid Firebase authentication token
   * - User can only access their own portfolio data
   * 
   * @example
   * GET /api/portfolio/user123
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "AAPL",
   *       "shares": 10,
   *       "totalValue": 1755.00,
   *       "gainLoss": 55.00,
   *       "gainLossPercent": 3.24
   *     }
   *   ]
   * }
   * ```
   */
  async getUserPortfolio(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId
    
    try {
      // Security check: user can only access their own portfolio
      if (req.user?.uid !== userId) {
        this.logSecurityEvent(req, 'UNAUTHORIZED_PORTFOLIO_ACCESS', { 
          requestedUserId: userId,
          authenticatedUserId: req.user?.uid 
        })
        res.status(403).json({
          success: false,
          error: 'Access denied: Cannot access another user\'s portfolio'
        })
        return
      }
      
      // Log successful portfolio access for audit trail
      this.logSecurityEvent(req, 'PORTFOLIO_ACCESS_SUCCESS', { userId })
      
      // Get portfolio from Firebase instead of Python service
      const portfolio = await this.calculateUserPortfolioFromFirebase(userId)
      
      res.json({
        success: true,
        data: portfolio,
      })
    } catch (error) {
      console.error('Error fetching user portfolio:', error)
      
      this.logSecurityEvent(req, 'PORTFOLIO_ACCESS_FAILED', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user portfolio'
      })
    }
  }

  /**
   * Get detailed data for a specific stock symbol
   * Uses Finnhub API with fallback to yfinance service
   * Public endpoint with input validation
   * 
   * @param req - Express request object
   * @param req.params.symbol - Stock symbol (e.g., 'AAPL', 'GOOGL')
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with stock data
   * 
   * @example
   * GET /api/stock/AAPL
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "symbol": "AAPL",
   *     "name": "Apple Inc.",
   *     "price": 175.50,
   *     "marketCap": "2.8T",
   *     "peRatio": 28.5,
   *     "weekHigh52": 182.94,
   *     "weekLow52": 124.17
   *   }
   * }
   * ```
   */
  async getStockData(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params
      
      // Input validation
      if (!symbol || !/^[A-Z^]{1,10}$/.test(symbol)) {
        res.status(400).json({
          success: false,
          error: 'Invalid stock symbol format'
        })
        return
      }
      
      // Use our new method with Finnhub primary and yfinance fallback
      const stock = await this.getStockDataWithFallback(symbol, true)
      
      res.json({
        success: true,
        data: stock,
      })
    } catch (error) {
      console.error('Error fetching stock data:', error)
      res.status(500).json({
        success: false,
        error: `Failed to fetch data for ${req.params.symbol}`
      })
    }
  }

  /**
   * Search for stocks by symbol or company name
   * Uses Finnhub symbol lookup with fallback to yfinance service
   * Public endpoint with comprehensive input validation
   * 
   * @param req - Express request object
   * @param req.query.q - Search query string
   * @param req.query.limit - Optional limit for results (default: 10, max: 25)
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with search results
   * 
   * @example
   * GET /api/search?q=Apple&limit=5
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "AAPL",
   *       "name": "Apple Inc.",
   *       "price": 175.50,
   *       "change": 2.30,
   *       "changePercent": 1.33
   *     }
   *   ]
   * }
   * ```
   */
  async searchStocks(req: Request, res: Response): Promise<void> {
    try {
      const { q, limit = 10 } = req.query
      
      // Input validation
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query is required'
        })
        return
      }
      
      if (q.length < 1 || q.length > 50) {
        res.status(400).json({
          success: false,
          error: 'Search query must be between 1 and 50 characters'
        })
        return
      }
      
      // Sanitize search query
      const sanitizedQuery = q.replace(/[^a-zA-Z0-9\s\.\-]/g, '')
      if (sanitizedQuery.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid search query format'
        })
        return
      }
      
      const parsedLimit = parseInt(limit as string)
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 25) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter (must be between 1 and 25)'
        })
        return
      }

      try {
        // Try Finnhub symbol lookup first
        console.log(`Searching stocks with Finnhub for query: ${sanitizedQuery}`)
        
        const searchResult = await this.callFinnhubAPI<FinnhubSymbolLookup>(
          `/search?q=${encodeURIComponent(sanitizedQuery)}`,
          CACHE_DURATIONS.SEARCH
        )

        if (searchResult && searchResult.result && searchResult.result.length > 0) {
          // Filter to US stocks and limit results
          const usStocks = searchResult.result
            .filter(item => item.type === 'Common Stock' && !item.symbol.includes('.'))
            .slice(0, parsedLimit)

          if (usStocks.length > 0) {
            // Get current prices for the found symbols using batched requests
            const requestFunctions = usStocks.map(stock => 
              () => this.getOptimizedStockData(stock.symbol).catch(error => {
                console.warn(`Failed to get price data for ${stock.symbol}:`, error)
                // Return basic data without current price
                return {
                  symbol: stock.symbol,
                  name: stock.description,
                  price: 0,
                  change: 0,
                  changePercent: 0,
                  volume: 0,
                  avgVolume: 0,
                  marketCap: 'N/A',
                  peRatio: null,
                  weekHigh52: 0,
                  weekLow52: 0,
                  weekChange52: 0,
                  chart: []
                } as StockData
              })
            )

            const stockResults = await this.processBatchedRequests(requestFunctions)
            const validResults = stockResults.filter(stock => stock && stock.price > 0)

            if (validResults.length > 0) {
              console.log(`Successfully found ${validResults.length} stocks via Finnhub search`)
              res.json({
                success: true,
                data: validResults,
              })
              return
            }
          }
        }

        throw new Error('No valid search results from Finnhub')

      } catch (finnhubError) {
        console.warn('Finnhub search failed, falling back to yfinance:', finnhubError)
        
        // Fallback to yfinance service
        const results = await this.callPythonService<StockData[]>(
          `/api/search?q=${encodeURIComponent(sanitizedQuery)}&limit=${parsedLimit}`, 
          req
        )
        
        res.json({
          success: true,
          data: results,
        })
      }
    } catch (error) {
      console.error('Error searching stocks from both APIs:', error)
      res.status(500).json({
        success: false,
        error: 'Stock search failed'
      })
    }
  }

  /**
   * Enhanced input sanitization for stock symbols
   * 
   * @param symbol - Raw symbol input
   * @returns Sanitized and validated symbol
   * @throws {Error} When symbol format is invalid
   */
  private sanitizeStockSymbol(symbol: string): string {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Stock symbol is required')
    }
    
    // Remove any non-alphanumeric characters except ^ and convert to uppercase
    const cleaned = symbol.toUpperCase().replace(/[^A-Z0-9^]/g, '')
    
    // Validate length and format
    if (cleaned.length < 1 || cleaned.length > 10) {
      throw new Error('Stock symbol must be 1-10 characters')
    }
    
    // Ensure it matches expected pattern
    if (!/^[A-Z^]{1,10}$/.test(cleaned)) {
      throw new Error('Invalid stock symbol format')
    }
    
    return cleaned
  }

  /**
   * Calculate user portfolio from Firebase transactions
   * Aggregates all transactions and gets current stock prices
   * 
   * @param userId - User ID to calculate portfolio for
   * @returns Promise resolving to portfolio stocks with current values
   */
  private async calculateUserPortfolioFromFirebase(userId: string): Promise<UserPortfolioStock[]> {
    if (!db) {
      throw new Error('Firestore not initialized')
    }

    try {
      // Get all transactions for the user using Firebase Admin SDK
      const transactionsSnapshot = await db
        .collection('stockTransactions')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .get()
      
      const transactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockTransaction[]
      
      // Aggregate holdings by symbol
      const holdings = new Map<string, { shares: number; totalInvested: number; avgPrice: number }>()
      
      for (const transaction of transactions) {
        const existing = holdings.get(transaction.symbol) || { shares: 0, totalInvested: 0, avgPrice: 0 }
        
        if (transaction.transactionType === 'buy') {
          const newShares = existing.shares + transaction.shares
          const newTotalInvested = existing.totalInvested + transaction.totalAmount
          holdings.set(transaction.symbol, {
            shares: newShares,
            totalInvested: newTotalInvested,
            avgPrice: newTotalInvested / newShares
          })
        } else if (transaction.transactionType === 'sell') {
          const newShares = Math.max(0, existing.shares - transaction.shares)
          const proportionSold = transaction.shares / existing.shares
          const newTotalInvested = existing.totalInvested * (1 - proportionSold)
          
          if (newShares > 0) {
            holdings.set(transaction.symbol, {
              shares: newShares,
              totalInvested: newTotalInvested,
              avgPrice: newTotalInvested / newShares
            })
          } else {
            holdings.delete(transaction.symbol)
          }
        }
      }
      
      // Convert holdings to portfolio stocks with current prices
      const portfolioStocks: UserPortfolioStock[] = []
      
      for (const [symbol, holding] of holdings) {
        try {
          // Get current stock data using our new fallback method
          const currentStockData = await this.getStockDataWithFallback(symbol, false)
          
          const totalValue = holding.shares * currentStockData.price
          const gainLoss = totalValue - holding.totalInvested
          const gainLossPercent = holding.totalInvested > 0 ? (gainLoss / holding.totalInvested) * 100 : 0
          
          portfolioStocks.push({
            symbol: currentStockData.symbol,
            name: currentStockData.name,
            price: currentStockData.price,
            change: currentStockData.change,
            changePercent: currentStockData.changePercent,
            shares: holding.shares,
            totalValue,
            purchasePrice: holding.avgPrice,
            gainLoss,
            gainLossPercent
          })
        } catch (stockError) {
          console.error(`Failed to get current price for ${symbol}:`, stockError)
          // Include holding with last known data if stock service fails
          portfolioStocks.push({
            symbol,
            name: symbol, // Fallback to symbol as name
            price: holding.avgPrice,
            change: 0,
            changePercent: 0,
            shares: holding.shares,
            totalValue: holding.shares * holding.avgPrice,
            purchasePrice: holding.avgPrice,
            gainLoss: 0,
            gainLossPercent: 0
          })
        }
      }
      
      return portfolioStocks.sort((a, b) => b.totalValue - a.totalValue) // Sort by total value descending
    } catch (error) {
      console.error('Error calculating portfolio from Firebase:', error)
      throw new Error('Failed to calculate portfolio')
    }
  }

  /**
   * Save transaction to Firebase
   * 
   * @param transaction - Transaction data to save
   * @returns Promise resolving when transaction is saved
   */
  private async saveTransactionToFirebase(transaction: Omit<StockTransaction, 'id'>): Promise<void> {
    if (!db) {
      throw new Error('Firestore not initialized')
    }

    try {
      await db.collection('stockTransactions').add({
        ...transaction,
        timestamp: new Date()
      })
      console.log(`Transaction saved to Firebase: ${transaction.transactionType} ${transaction.shares} shares of ${transaction.symbol}`)
    } catch (error) {
      console.error('Failed to save transaction to Firebase:', error)
      throw new Error('Failed to save transaction')
    }
  }

  /**
   * Security logging for suspicious activities
   * 
   * @param req - Express request object
   * @param action - Action being performed
   * @param details - Additional details for logging
   */
  private logSecurityEvent(req: Request, action: string, details: any = {}): void {
    const securityLog = {
      timestamp: new Date().toISOString(),
      action,
      userId: req.user?.uid || 'anonymous',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      ...details
    }
    
    console.log('SECURITY_EVENT:', JSON.stringify(securityLog))
  }

  /**
   * Execute a stock transaction (buy/sell) with validation
   * Protected endpoint - requires authentication
   * 
   * @param req - Express request object
   * @param req.body.symbol - Stock symbol
   * @param req.body.type - Transaction type ('buy' or 'sell')
   * @param req.body.amount - Dollar amount for transaction
   * @param req.body.price - Current stock price
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response confirming transaction
   */
  async executeTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { symbol, type, amount, price } = req.body
      const userId = req.user?.uid
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
        return
      }
      
      // Input validation
      if (!symbol || !type || !amount || !price) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: symbol, type, amount, price'
        })
        return
      }
      
      if (type !== 'buy' && type !== 'sell') {
        res.status(400).json({
          success: false,
          error: 'Transaction type must be buy or sell'
        })
        return
      }
      
      const numericAmount = parseFloat(amount)
      const numericPrice = parseFloat(price)
      
      if (isNaN(numericAmount) || numericAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Amount must be a positive number'
        })
        return
      }
      
      if (isNaN(numericPrice) || numericPrice <= 0) {
        res.status(400).json({
          success: false,
          error: 'Price must be a positive number'
        })
        return
      }
      
      // Calculate shares (round to 2 decimal places)
      const shares = Math.floor(numericAmount / numericPrice * 100) / 100
      
      if (shares <= 0) {
        res.status(400).json({
          success: false,
          error: 'Transaction amount is too small to purchase any shares'
        })
        return
      }
      
      // For sell transactions, validate user has enough shares
      if (type === 'sell') {
        try {
          const portfolio = await this.calculateUserPortfolioFromFirebase(userId)
          const holding = portfolio.find(stock => stock.symbol === symbol)
          
          if (!holding) {
            res.status(400).json({
              success: false,
              error: `Cannot sell ${symbol} - you don't own any shares of this stock`
            })
            return
          }
          
          if (holding.shares < shares) {
            res.status(400).json({
              success: false,
              error: `Cannot sell ${shares} shares of ${symbol} - you only own ${holding.shares} shares`
            })
            return
          }
        } catch (portfolioError) {
          console.error('Error validating portfolio for sell transaction:', portfolioError)
          res.status(500).json({
            success: false,
            error: 'Failed to validate portfolio holdings'
          })
          return
        }
      }
      
      // Execute transaction and save to Firebase
      const sanitizedSymbol = this.sanitizeStockSymbol(symbol)
      
      try {
        await this.saveTransactionToFirebase({
          userId,
          symbol: sanitizedSymbol,
          transactionType: type,
          shares,
          pricePerShare: numericPrice,
          totalAmount: shares * numericPrice,
          transactionDate: new Date().toISOString(),
          createdAt: new Date().toISOString()
        })
        
        this.logSecurityEvent(req, 'TRANSACTION_EXECUTED', {
          symbol: sanitizedSymbol,
          type,
          amount: numericAmount,
          shares,
          price: numericPrice
        })
        
        res.json({
          success: true,
          message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${shares} shares of ${sanitizedSymbol}`,
          data: {
            symbol: sanitizedSymbol,
            type,
            shares,
            price: numericPrice,
            totalValue: shares * numericPrice
          }
        })
      } catch (transactionError) {
        console.error('Transaction execution failed:', transactionError)
        res.status(500).json({
          success: false,
          error: 'Failed to execute transaction'
        })
      }
      
    } catch (error) {
      console.error('Error in executeTransaction:', error)
      res.status(500).json({
        success: false,
        error: 'Transaction failed'
      })
    }
  }

  /**
   * Get maximum sellable amount for a stock
   * Protected endpoint - requires authentication
   * 
   * @param req - Express request object
   * @param req.params.symbol - Stock symbol
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with max sell info
   */
  async getMaxSellAmount(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params
      const userId = req.user?.uid
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
        return
      }
      
      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Stock symbol is required'
        })
        return
      }
      
      const sanitizedSymbol = this.sanitizeStockSymbol(symbol)
      
      try {
        // Get user's portfolio from Firebase
        const portfolio = await this.calculateUserPortfolioFromFirebase(userId)
        const holding = portfolio.find(stock => stock.symbol === sanitizedSymbol)
        
        if (!holding) {
          res.json({
            success: true,
            data: {
              shares: 0,
              value: 0,
              price: 0
            }
          })
          return
        }
        
        // Get current stock price using our new fallback method
        try {
          const stockData = await this.getStockDataWithFallback(sanitizedSymbol, false)
          res.json({
            success: true,
            data: {
              shares: holding.shares,
              value: holding.shares * stockData.price,
              price: stockData.price
            }
          })
        } catch (priceError) {
          // Fallback to purchase price if current price unavailable
          res.json({
            success: true,
            data: {
              shares: holding.shares,
              value: holding.shares * holding.purchasePrice,
              price: holding.purchasePrice
            }
          })
        }
        
      } catch (portfolioError) {
        console.error('Error getting portfolio for max sell amount:', portfolioError)
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve portfolio information'
        })
      }
      
    } catch (error) {
      console.error('Error in getMaxSellAmount:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get maximum sell amount'
      })
    }
  }

  /**
   * Get user's transaction history
   * Protected endpoint - requires authentication
   * 
   * @param req - Express request object
   * @param req.query.limit - Optional limit for results (default: 50, max: 100)
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with transaction history
   */
  async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid
      const { limit = 50 } = req.query
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
        return
      }
      
      const parsedLimit = parseInt(limit as string)
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter (must be between 1 and 100)'
        })
        return
      }
      
      try {
        if (!db) {
          throw new Error('Firestore not initialized')
        }

        const transactionsSnapshot = await db
          .collection('stockTransactions')
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(parsedLimit)
          .get()
        
        const transactions = transactionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp
        }))
        
        res.json({
          success: true,
          data: transactions
        })
      } catch (serviceError) {
        console.error('Error getting transaction history from Firebase:', serviceError)
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve transaction history'
        })
      }
      
    } catch (error) {
      console.error('Error in getTransactionHistory:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction history'
      })
    }
  }
}

const stocksController = new StocksController()

/**
 * Exported controller methods for use in routes
 * All methods are bound to preserve 'this' context
 */
export default {
  getMarketIndices: stocksController.getMarketIndices.bind(stocksController),
  getTrendingStocks: stocksController.getTrendingStocks.bind(stocksController),
  getUserPortfolio: stocksController.getUserPortfolio.bind(stocksController),
  getStockData: stocksController.getStockData.bind(stocksController),
  searchStocks: stocksController.searchStocks.bind(stocksController),
  executeTransaction: stocksController.executeTransaction.bind(stocksController),
  getMaxSellAmount: stocksController.getMaxSellAmount.bind(stocksController),
  getTransactionHistory: stocksController.getTransactionHistory.bind(stocksController),
}

/*
Example Python service using yfinance:

```python
# stock_service.py
import yfinance as yf
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/market-indices')
def get_market_indices():
    symbols = ['^IXIC', '^DJI', '^GSPC']
    indices = []
    
    for symbol in symbols:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period='2d')
        
        current_price = hist['Close'].iloc[-1]
        prev_price = hist['Close'].iloc[-2]
        change = current_price - prev_price
        change_percent = (change / prev_price) * 100
        
        indices.append({
            'symbol': symbol,
            'name': info.get('longName', symbol),
            'price': current_price,
            'change': change,
            'changePercent': change_percent
        })
    
    return jsonify(indices)

@app.route('/api/trending-stocks')
def get_trending_stocks():
    # Implementation for trending stocks
    pass

@app.route('/api/stock/<symbol>')
def get_stock_data(symbol):
    ticker = yf.Ticker(symbol)
    info = ticker.info
    hist = ticker.history(period='1y')
    
    # Calculate metrics and return stock data
    pass

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

To use this with Docker:

```dockerfile
# Dockerfile for Python service
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "stock_service.py"]
```

requirements.txt:
```
yfinance==0.2.28
flask==2.3.3
flask-cors==4.0.0
pandas==2.1.0
numpy==1.24.3
```
*/ 