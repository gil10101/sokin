/**
 * @fileoverview Stock API service for interfacing with the backend stock service
 * Provides real-time stock data, portfolio management, and WebSocket price updates
 * 
 * All data operations are now routed through the backend API for proper
 * separation of concerns and centralized business logic.
 * 
 * @version 2.0.0
 * @author Sokin Team
 */

import { auth } from './firebase'
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
 * Portfolio holding stored in backend
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
 * - Portfolio management via backend API
 * - Watchlist management via backend API
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
          const retryAfter = errorData.retryAfter || Math.pow(2, attempt)
          
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
            const delay = Math.pow(2, attempt) * 1000
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
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Check cache for data and return if not expired
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
   */
  static async getTrendingStocks(limit: number = 10): Promise<StockData[]> {
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
   * Get detailed user portfolio including stock positions via backend API
   * userId is derived from auth token on the backend - passed here for caching only
   */
  static async getUserPortfolio(userId: string): Promise<UserPortfolioStock[]> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required')
    }

    const cacheKey = `portfolio-${userId}`
    const cached = this.getFromCache<UserPortfolioStock[]>(cacheKey)
    if (cached) return cached

    const headers = await this.getAuthHeaders()
    // userId is derived from auth token on backend - no IDOR vulnerability
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/portfolio`, { headers })
    const result = await this.handleResponse<UserPortfolioStock[]>(response)
    
    this.setCache(cacheKey, result, 15000) // Cache for 15 seconds
    return result
  }

  /**
   * Get detailed stock data for a single symbol
   */
  static async getStockData(symbol: string): Promise<StockData> {
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
   */
  static async searchStocks(query: string, limit: number = 10): Promise<StockData[]> {
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required')
    }
    
    if (limit < 1 || limit > 25) {
      throw new Error('Limit must be between 1 and 25')
    }
    
    const cleanedQuery = query.trim().slice(0, 50)
    
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

  /**
   * Get portfolio holdings via backend API
   * userId is derived from auth token on the backend - passed here for response mapping
   */
  static async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    // userId is derived from auth token on backend - no IDOR vulnerability
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/portfolio`, { headers })
    
    // Use handleResponse for consistent error handling
    const portfolioData = await this.handleResponse<UserPortfolioStock[] | { holdings: UserPortfolioStock[] }>(response)
    
    // Handle both array and object response structures
    const holdings = Array.isArray(portfolioData) ? portfolioData : (portfolioData.holdings || [])
    
    // Map the response to PortfolioHolding format
    // Backend doesn't currently include timestamps, use current time as placeholder
    const now = new Date()
    return holdings.map((h: UserPortfolioStock) => ({
      userId,
      symbol: h.symbol,
      shares: h.shares,
      averagePrice: h.purchasePrice,
      totalInvested: h.purchasePrice * h.shares,
      createdAt: now,
      updatedAt: now,
    }))
  }

  /**
   * Execute a stock transaction via backend API
   * @deprecated Use executeCurrencyTransaction for new implementations
   */
  static async executeTransaction(transaction: Omit<StockTransaction, 'id'>): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        symbol: transaction.symbol,
        type: transaction.transactionType,
        amount: transaction.totalAmount,
        price: transaction.pricePerShare
      })
    })
    
    await this.handleResponse(response)
    
    // Clear cache after successful transaction
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

  /**
   * Get user watchlist via backend API
   */
  static async getUserWatchlist(userId: string): Promise<string[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/watchlist`, { headers })
    
    // Use handleResponse for consistent error handling
    const watchlistData = await this.handleResponse<string[] | { symbols: string[] }>(response)
    
    // Handle both array and object response structures
    return Array.isArray(watchlistData) ? watchlistData : (watchlistData.symbols || [])
  }

  /**
   * Update entire watchlist via backend API
   */
  static async updateWatchlist(userId: string, symbols: string[]): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/watchlist`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ symbols })
    })
    
    await this.handleResponse(response)
  }

  /**
   * Add symbol to watchlist via backend API
   */
  static async addToWatchlist(userId: string, symbol: string): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/watchlist`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ symbol: symbol.toUpperCase() })
    })
    
    await this.handleResponse(response)
  }

  /**
   * Remove symbol from watchlist via backend API
   */
  static async removeFromWatchlist(userId: string, symbol: string): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/watchlist/${symbol.toUpperCase()}`, {
      method: 'DELETE',
      headers
    })
    
    await this.handleResponse(response)
  }

  /**
   * Get transaction history via backend API
   */
  static async getTransactionHistory(userId: string): Promise<StockTransaction[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/transactions`, { headers })
    return this.handleResponse<StockTransaction[]>(response)
  }

  /**
   * Clear cache (useful for debugging or force refresh)
   */
  static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Reset connection state (useful for debugging or reconnection)
   */
  static resetConnectionState(): void {
    this.connectionAttempted = false
    this.connectionFailed = false
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.priceUpdateCallbacks.clear()
  }

  /**
   * Initialize WebSocket connection for real-time price updates
   */
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
          timeout: 5000,
          forceNew: true,
        })

        this.socket.on('connect', () => {
          this.connectionFailed = false
        })

        this.socket.on('disconnect', () => {
          // Connection closed
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

        this.socket.on('connect_error', () => {
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
        // WebSocket initialization failed - log in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.debug('WebSocket initialization failed:', error)
        }
        this.connectionFailed = true
        this.socket = null
      }
    }

    return this.socket
  }

  /**
   * Subscribe to real-time stock price updates
   */
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
      if (socket) {
        socket.emit('subscribe_prices', { symbols })
      }
    }).catch(() => {
      // Connection failed silently
    })

    // Return unsubscribe function
    return () => {
      symbols.forEach(symbol => {
        const callbacks = this.priceUpdateCallbacks.get(symbol)
        if (callbacks) {
          callbacks.clear()
          if (callbacks.size === 0) {
            this.priceUpdateCallbacks.delete(symbol)
          }
        }
      })

      this.initializeSocket().then(socket => {
        if (socket) {
          socket.emit('unsubscribe_prices', { symbols })
        }
      }).catch(() => {
        // Unsubscribe failed silently
      })
    }
  }

  /**
   * Disconnect WebSocket connection
   */
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
