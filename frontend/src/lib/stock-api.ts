/**
 * @fileoverview Stock API service for interfacing with the backend stock service
 * Provides real-time stock data, portfolio management, and WebSocket price updates
 * 
 * @version 1.0.0
 * @author Sokin Team
 */

// Stock API service
import { auth, db } from './firebase'
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  addDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { io, Socket } from 'socket.io-client'

/**
 * Stock data interface representing real-time stock information
 */
export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  marketCap: string
  peRatio: number | null
  weekHigh52: number
  weekLow52: number
  weekChange52: number
  chart?: number[] // Simple array of price points for sparkline
}

/**
 * Market index data interface (S&P 500, NASDAQ, Dow Jones)
 */
export interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

/**
 * User portfolio stock with calculated gains/losses
 */
export interface UserPortfolioStock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  shares: number
  totalValue: number
  purchasePrice: number
  gainLoss: number
  gainLossPercent: number
}

/**
 * Portfolio holding stored in Firestore
 */
export interface PortfolioHolding {
  id?: string
  userId: string
  symbol: string
  shares: number
  averagePrice: number
  totalInvested: number
  createdAt: Date
  updatedAt: Date
}

/**
 * Stock transaction record (updated to support currency-based transactions)
 */
export interface StockTransaction {
  id?: string
  userId: string
  symbol: string
  transactionType: 'buy' | 'sell'
  shares: number
  pricePerShare: number
  totalAmount: number
  transactionDate: string
  createdAt: string
  timestamp?: Date
}



/**
 * Currency-based transaction request (new interface for UI)
 */
export interface CurrencyTransaction {
  userId: string
  symbol: string
  type: 'buy' | 'sell'
  amount: number // Currency amount instead of shares
  price: number
}

/**
 * User watchlist structure
 */
export interface UserWatchlist {
  id?: string
  userId: string
  symbols: string[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Cache entry interface for in-memory caching
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * StockAPI class provides comprehensive stock data management
 * Features:
 * - Real-time stock data via REST API
 * - WebSocket price updates
 * - Portfolio management
 * - Watchlist management
 * - Intelligent caching with TTL
 * - Authentication integration
 * - Error handling and retry logic
 * 
 * @example
 * ```typescript
 * // Get market indices
 * const indices = await StockAPI.getMarketIndices()
 * 
 * // Subscribe to real-time prices
 * const unsubscribe = StockAPI.subscribeToStockPrices(['AAPL', 'GOOGL'], (symbol, data) => {
 *   updatePriceDisplay(symbol, data.price)
 * })
 * ```
 */
export class StockAPI {
  /**
   * Base URL for the stock API service
   * Automatically determines URL based on environment
   */
  private static baseUrl = (() => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL
    if (!envUrl) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured')
    }
    // If environment URL doesn't end with /api, add it
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
  })()

  // WebSocket connection for real-time updates
  private static socket: Socket | null = null
  private static priceUpdateCallbacks = new Map<string, Set<(data: StockData) => void>>()
  private static connectionAttempted = false
  private static connectionFailed = false

  // Simple in-memory cache
  private static cache = new Map<string, CacheEntry<StockData | MarketIndex[] | UserPortfolioStock[] | StockData[]>>()

  /**
   * Get authentication headers for API requests
   * 
   * @returns Promise resolving to headers object with authorization token
   * @throws {Error} When user is not authenticated
   * 
   * @example
   * ```typescript
   * const headers = await StockAPI.getAuthHeaders()
   * // headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ...' }
   * ```
   */
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser
    if (!user) {
      throw new Error('User not authenticated')
    }
    
    const token = await user.getIdToken()
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
  }

  /**
   * Enhanced fetch with retry logic, rate limit handling, and timeout
   * 
   * @param url - The URL to fetch
   * @param options - Fetch options
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @returns Promise resolving to Response object
   * 
   * @throws {Error} When max retries exceeded
   * @throws {Error} When rate limited
   * @throws {Error} When network error occurs
   * 
   * @example
   * ```typescript
   * const response = await StockAPI.fetchWithRetry('/api/stock/AAPL', {
   *   headers: await StockAPI.getAuthHeaders()
   * })
   * ```
   */
  private static async fetchWithRetry(
    url: string, 
    options: RequestInit = {}, 
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {

        
        // Add timeout to request
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        // If it's a rate limit error, handle it specially
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}))
          const retryAfter = errorData.retryAfter || Math.pow(2, attempt) // Use exponential backoff if no retryAfter
          
          if (attempt < maxRetries) {

            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
            continue
          }
          
          throw new Error(`Rate limited: ${errorData.error || 'Too many requests'}. Please try again in ${retryAfter} seconds.`)
        }
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        

        return response
      } catch (error) {
        lastError = error as Error

        
        // Handle abort error (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000 // Exponential backoff

            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          throw new Error('Request timeout')
        }
        
        // Don't retry on non-network errors
        if (!(error instanceof TypeError && error.message.includes('fetch'))) {
          throw error
        }
        
        // Network error - retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff

          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Check cache for data and return if not expired
   *
   * @param key - Cache key
   * @returns Cached data or null if expired/not found
   */
  private static getFromCache<T extends StockData | MarketIndex[] | UserPortfolioStock[] | StockData[]>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Store data in cache with TTL
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds (default: 30 seconds)
   */
  private static setCache<T extends StockData | MarketIndex[] | UserPortfolioStock[] | StockData[]>(key: string, data: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  /**
   * Handle API response and extract data
   * 
   * @template T - Expected response data type
   * @param response - Fetch response object
   * @returns Promise resolving to parsed response data
   * 
   * @throws {Error} When response parsing fails
   */
  private static async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'API request failed')
    }
    return data.data
  }

  /**
   * Get trending stocks with optional limit
   * 
   * @param limit - Number of trending stocks to fetch (default: 10, max: 50)
   * @returns Promise resolving to array of trending stock data
   * 
   * @example
   * ```typescript
   * const trending = await StockAPI.getTrendingStocks(5)
   * (trending[0].symbol) // 'AAPL'
   * ```
   */
  static async getTrendingStocks(limit: number = 10): Promise<StockData[]> {
    // Input validation
    if (limit < 1 || limit > 50) {
      throw new Error('Limit must be between 1 and 50')
    }

    const cacheKey = `trending-stocks-${limit}`
    const cached = this.getFromCache<StockData[]>(cacheKey)
    if (cached) return cached

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/trending?limit=${limit}`)
    const data = await this.handleResponse<StockData[]>(response)
    
    this.setCache(cacheKey, data, 60000) // Cache for 1 minute
    return data
  }

  /**
   * Get market indices data (S&P 500, NASDAQ, DOW, etc.)
   * 
   * @returns Promise resolving to array of market index data
   * 
   * @example
   * ```typescript
   * const indices = await StockAPI.getMarketIndices()
   * const sp500 = indices.find(idx => idx.symbol === '^GSPC')
   * ```
   */
  static async getMarketIndices(): Promise<MarketIndex[]> {
    const cacheKey = 'market-indices'
    const cached = this.getFromCache<MarketIndex[]>(cacheKey)
    if (cached) return cached

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/market-indices`)
    const data = await this.handleResponse<MarketIndex[]>(response)
    
    this.setCache(cacheKey, data, 30000) // Cache for 30 seconds
    return data
  }

  /**
   * Get detailed user portfolio including stock positions
   * Requires authentication
   * 
   * @param userId - The user ID to fetch portfolio for
   * @returns Promise resolving to array of portfolio holdings
   * 
   * @example
   * ```typescript
   * const portfolio = await StockAPI.getUserPortfolio('user123')
   * const totalValue = portfolio.reduce((sum, stock) => sum + stock.totalValue, 0)
   * ```
   */
  static async getUserPortfolio(userId: string): Promise<UserPortfolioStock[]> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required')
    }

    const cacheKey = `portfolio-${userId}`
    const cached = this.getFromCache<UserPortfolioStock[]>(cacheKey)
    if (cached) return cached

    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/portfolio/${userId}`, { headers })
    const result = await this.handleResponse<UserPortfolioStock[]>(response)
    
    this.setCache(cacheKey, result, 15000) // Cache for 15 seconds
    return result
  }

  /**
   * Get detailed stock data for a single symbol
   * 
   * @param symbol - Stock symbol to fetch data for
   * @returns Promise resolving to detailed stock data
   * 
   * @example
   * ```typescript
   * const apple = await StockAPI.getStockData('AAPL')
   * (`AAPL: $${apple.price} (${apple.changePercent}%)`)
   * ```
   */
  static async getStockData(symbol: string): Promise<StockData> {
    // Input validation and sanitization
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Stock symbol is required')
    }
    
    const cleanedSymbol = symbol.toUpperCase().trim()
    
    if (!/^[A-Z^]{1,10}$/.test(cleanedSymbol)) {
      throw new Error('Invalid stock symbol format')
    }

    const cacheKey = `stock-${cleanedSymbol}`
    const cached = this.getFromCache<StockData>(cacheKey)
    if (cached) return cached

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/stock/${cleanedSymbol}`)
    const data = await this.handleResponse<StockData>(response)
    
    this.setCache(cacheKey, data, 15000) // Cache for 15 seconds
    return data
  }

  /**
   * Search for stocks by company name or symbol
   * 
   * @param query - Search query (company name or symbol)
   * @param limit - Maximum number of results (default: 10, max: 25)
   * @returns Promise resolving to array of matching stocks
   * 
   * @example
   * ```typescript
   * const results = await StockAPI.searchStocks('apple', 5)
   * const apple = results.find(stock => stock.symbol === 'AAPL')
   * ```
   */
  static async searchStocks(query: string, limit: number = 10): Promise<StockData[]> {
    // Input validation and sanitization
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required')
    }
    
    if (limit < 1 || limit > 25) {
      throw new Error('Limit must be between 1 and 25')
    }
    
    const cleanedQuery = query.trim().slice(0, 50) // Limit query length for security
    
    if (cleanedQuery.length === 0) {
      throw new Error('Search query cannot be empty')
    }

    const cacheKey = `search-${cleanedQuery}-${limit}`
    const cached = this.getFromCache<StockData[]>(cacheKey)
    if (cached) return cached

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/search?q=${encodeURIComponent(cleanedQuery)}&limit=${limit}`)
    const data = await this.handleResponse<StockData[]>(response)
    
    this.setCache(cacheKey, data, 60000) // Cache for 1 minute
    return data
  }

  // Firestore-based portfolio management
  static async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const holdingsQuery = query(
      collection(db, 'portfolios'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    )
    
    const snapshot = await getDocs(holdingsQuery)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as PortfolioHolding[]
  }

  static async executeTransaction(transaction: Omit<StockTransaction, 'id'>): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    // Validation for sell transactions
    if (transaction.transactionType === 'sell') {
      const holdings = await this.getPortfolioHoldings(transaction.userId)
      const currentHolding = holdings.find(h => h.symbol === transaction.symbol)
      
      if (!currentHolding) {
        throw new Error(`Cannot sell ${transaction.symbol} - you don't own any shares of this stock`)
      }
      
      if (currentHolding.shares < transaction.shares) {
        throw new Error(`Cannot sell ${transaction.shares} shares of ${transaction.symbol} - you only own ${currentHolding.shares} shares`)
      }
    }
    
    const batch = writeBatch(db)
    
    // Add transaction record
    const transactionRef = doc(collection(db, 'stockTransactions'))
    batch.set(transactionRef, {
      ...transaction,
      timestamp: serverTimestamp(),
    })
    
    // Update portfolio holding
    const holdingsQuery = query(
      collection(db, 'portfolios'),
      where('userId', '==', transaction.userId),
      where('symbol', '==', transaction.symbol)
    )
    
    const holdingsSnapshot = await getDocs(holdingsQuery)
    
    if (holdingsSnapshot.empty && transaction.transactionType === 'buy') {
      // Create new holding
      const newHoldingRef = doc(collection(db, 'portfolios'))
      batch.set(newHoldingRef, {
        userId: transaction.userId,
        symbol: transaction.symbol,
        shares: transaction.shares,
        averagePrice: transaction.pricePerShare,
        totalInvested: transaction.totalAmount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } else if (!holdingsSnapshot.empty) {
      // Update existing holding
      const holdingDoc = holdingsSnapshot.docs[0]
      const currentHolding = holdingDoc.data() as PortfolioHolding
      
      if (transaction.transactionType === 'buy') {
        const newShares = currentHolding.shares + transaction.shares
        const newTotalInvested = currentHolding.totalInvested + transaction.totalAmount
        const newAveragePrice = newTotalInvested / newShares
        
        batch.update(holdingDoc.ref, {
          shares: newShares,
          averagePrice: newAveragePrice,
          totalInvested: newTotalInvested,
          updatedAt: serverTimestamp(),
        })
      } else if (transaction.transactionType === 'sell') {
        const newShares = Math.max(0, currentHolding.shares - transaction.shares)
        
        if (newShares === 0) {
          // Remove holding if all shares sold
          batch.delete(holdingDoc.ref)
        } else {
          // Update shares and total invested proportionally
          const proportionSold = transaction.shares / currentHolding.shares
          const newTotalInvested = currentHolding.totalInvested * (1 - proportionSold)
          
          batch.update(holdingDoc.ref, {
            shares: newShares,
            totalInvested: newTotalInvested,
            updatedAt: serverTimestamp(),
          })
        }
      }
    } else if (transaction.transactionType === 'sell') {
      // This should not happen due to validation above, but keeping as failsafe
      throw new Error(`Cannot sell ${transaction.symbol} - you don't own any shares of this stock`)
    }
    
    await batch.commit()
    
    // Clear cache
    this.clearCache()
  }

  /**
   * Execute a currency-based transaction via backend API
   */
  static async executeCurrencyTransaction(currencyTransaction: CurrencyTransaction): Promise<void> {
    const headers = await this.getAuthHeaders()
    
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        symbol: currencyTransaction.symbol,
        type: currencyTransaction.type,
        amount: currencyTransaction.amount,
        price: currencyTransaction.price
      })
    })
    
    await this.handleResponse(response)
    
    // Clear cache after successful transaction
    this.clearCache()
  }

  /**
   * Get the maximum amount a user can sell for a given stock via backend API
   */
  static async getMaxSellAmount(userId: string, symbol: string): Promise<{ shares: number; value: number; price: number }> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/max-sell/${symbol}`, { headers })
    return this.handleResponse<{ shares: number; value: number; price: number }>(response)
  }

  // Firestore-based watchlist management
  static async getUserWatchlist(userId: string): Promise<string[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const watchlistDoc = await getDoc(doc(db, 'watchlists', userId))
    
    if (watchlistDoc.exists()) {
      const data = watchlistDoc.data() as UserWatchlist
      return data.symbols || []
    }
    
    return []
  }

  static async updateWatchlist(userId: string, symbols: string[]): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const watchlistRef = doc(db, 'watchlists', userId)
    const docSnapshot = await getDoc(watchlistRef)
    
    if (docSnapshot.exists()) {
      await updateDoc(watchlistRef, {
        symbols,
        updatedAt: serverTimestamp(),
      })
    } else {
      await setDoc(watchlistRef, {
        userId,
        symbols,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  }

  static async addToWatchlist(userId: string, symbol: string): Promise<void> {
    const currentWatchlist = await this.getUserWatchlist(userId)
    if (!currentWatchlist.includes(symbol)) {
      await this.updateWatchlist(userId, [...currentWatchlist, symbol])
    }
  }

  static async removeFromWatchlist(userId: string, symbol: string): Promise<void> {
    const currentWatchlist = await this.getUserWatchlist(userId)
    await this.updateWatchlist(userId, currentWatchlist.filter(s => s !== symbol))
  }

  static async getTransactionHistory(userId: string): Promise<StockTransaction[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/transactions`, { headers })
    return this.handleResponse<StockTransaction[]>(response)
  }

  // Clear cache (useful for debugging or force refresh)
  static clearCache(): void {
    this.cache.clear()

  }

  // Reset connection state (useful for debugging or reconnection)
  static resetConnectionState(): void {
    this.connectionAttempted = false
    this.connectionFailed = false
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.priceUpdateCallbacks.clear()

  }

  // WebSocket connection management
  private static async initializeSocket(): Promise<Socket | null> {
    // Don't attempt connection if already failed
    if (this.connectionFailed) {
      return null
    }

    if (!this.socket && !this.connectionAttempted) {
      this.connectionAttempted = true
      
      try {
        // First check if the service supports WebSockets by testing the health endpoint
        const healthUrl = this.baseUrl.replace('/api', '/health')
        const healthResponse = await fetch(healthUrl, { 
          method: 'GET'
        })
        
        if (!healthResponse.ok) {

          this.connectionFailed = true
          return null
        }
        
        const healthData = await healthResponse.json()
        
        // Check if the service indicates WebSocket support
        if (healthData.status !== 'healthy') {

          this.connectionFailed = true
          return null
        }
        
        const socketUrl = this.baseUrl.replace('/api', '')
        this.socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          timeout: 5000, // 5 second timeout
          forceNew: true,
        })

        this.socket.on('connect', () => {

          this.connectionFailed = false
        })

        this.socket.on('disconnect', () => {

        })

        this.socket.on('price_updates', (data: Record<string, StockData>) => {
          // Broadcast price updates to all registered callbacks
          Object.entries(data).forEach(([symbol, priceData]) => {
            const callbacks = this.priceUpdateCallbacks.get(symbol)
            if (callbacks) {
              callbacks.forEach(callback => callback(priceData))
            }
          })
        })

        this.socket.on('connect_error', (error) => {

          this.connectionFailed = true
          this.socket = null
        })

        // Set a timeout to mark connection as failed if not connected within 5 seconds
        setTimeout(() => {
          if (this.socket && !this.socket.connected) {

            this.connectionFailed = true
            this.socket.disconnect()
            this.socket = null
          }
        }, 5000)
      } catch (error) {

        this.connectionFailed = true
        this.socket = null
      }
    }

    return this.socket
  }

  static subscribeToStockPrices(symbols: string[], callback: (symbol: string, data: StockData) => void): () => void {
    // Register callback for each symbol
    symbols.forEach(symbol => {
      if (!this.priceUpdateCallbacks.has(symbol)) {
        this.priceUpdateCallbacks.set(symbol, new Set())
      }

      const symbolCallback = (data: StockData) => callback(symbol, data)
      this.priceUpdateCallbacks.get(symbol)!.add(symbolCallback)
    })

    // Initialize socket connection asynchronously
    this.initializeSocket().then(socket => {
      // Subscribe to price updates for these symbols (only if socket is available)
      if (socket) {
        socket.emit('subscribe_prices', { symbols })
      }
    }).catch(error => {

    })

    // Return unsubscribe function
    return () => {
      symbols.forEach(symbol => {
        const callbacks = this.priceUpdateCallbacks.get(symbol)
        if (callbacks) {
          // Remove specific callback (this is simplified - in practice you'd need to track the specific callback)
          callbacks.clear()
          if (callbacks.size === 0) {
            this.priceUpdateCallbacks.delete(symbol)
          }
        }
      })

      // Unsubscribe from price updates (only if socket is available)
      this.initializeSocket().then(socket => {
        if (socket) {
          socket.emit('unsubscribe_prices', { symbols })
        }
      }).catch(error => {

      })
    }
  }

  static disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.priceUpdateCallbacks.clear()
    }
  }
}

// Utility functions
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

export const formatChange = (change: number): string => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}`
}

export const formatPercent = (percent: number): string => {
  const sign = percent >= 0 ? '+' : ''
  return `${sign}${percent.toFixed(2)}%`
}

export const formatVolume = (volume: number): string => {
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(1)}B`
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(1)}M`
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(1)}K`
  }
  return volume.toString()
} 