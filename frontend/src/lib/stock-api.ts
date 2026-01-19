/**
 * Stock API client: REST + WebSocket with auth, caching, retries.
 */

import { auth } from './firebase'
import { io, Socket } from 'socket.io-client'

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
  chart?: number[] // sparkline points
}

export interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

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

export interface CurrencyTransaction {
  userId: string
  symbol: string
  type: 'buy' | 'sell'
  amount: number // Currency amount instead of shares
  price: number
}

export interface UserWatchlist {
  id?: string
  userId: string
  symbols: string[]
  createdAt: Date
  updatedAt: Date
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class StockAPI {
  // Base API URL from env (ensure /api suffix).
  private static baseUrl = (() => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL
    if (!envUrl) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured')
    }
    // If environment URL doesn't end with /api, add it
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
  })()

  private static socket: Socket | null = null
  private static priceUpdateCallbacks = new Map<string, Set<(data: StockData) => void>>()
  private static connectionAttempted = false
  private static connectionFailed = false

  private static cache = new Map<string, CacheEntry<StockData | MarketIndex[] | UserPortfolioStock[] | StockData[]>>()

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

  private static async fetchWithRetry(
    url: string, 
    options: RequestInit = {}, 
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        // 429: backoff
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
        
        // Timeout
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          throw new Error('Request timeout')
        }
        
        // No retry for non-network errors
        if (!(error instanceof TypeError && error.message.includes('fetch'))) {
          throw error
        }
        
        // Retry with backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }

  private static getFromCache<T extends StockData | MarketIndex[] | UserPortfolioStock[] | StockData[]>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  private static setCache<T extends StockData | MarketIndex[] | UserPortfolioStock[] | StockData[]>(key: string, data: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error || 'API request failed')
    }
    return data.data
  }

  static async getTrendingStocks(limit: number = 10): Promise<StockData[]> {
    if (limit < 1 || limit > 50) {
      throw new Error('Limit must be between 1 and 50')
    }

    const cacheKey = `trending-stocks-${limit}`
    const cached = this.getFromCache<StockData[]>(cacheKey)
    if (cached) return cached

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/trending?limit=${limit}`)
    const data = await this.handleResponse<StockData[]>(response)
    
    this.setCache(cacheKey, data, 60000) // 1m
    return data
  }

  static async getMarketIndices(): Promise<MarketIndex[]> {
    const cacheKey = 'market-indices'
    const cached = this.getFromCache<MarketIndex[]>(cacheKey)
    if (cached) return cached

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/market-indices`)
    const data = await this.handleResponse<MarketIndex[]>(response)
    
    this.setCache(cacheKey, data, 30000) // 30s
    return data
  }

  static async getUserPortfolio(userId: string): Promise<UserPortfolioStock[]> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required')
    }

    const cacheKey = `portfolio-${userId}`
    const cached = this.getFromCache<UserPortfolioStock[]>(cacheKey)
    if (cached) return cached

    const headers = await this.getAuthHeaders()
    // userId from auth token on backend
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/portfolio`, { headers })
    const result = await this.handleResponse<UserPortfolioStock[]>(response)
    
    this.setCache(cacheKey, result, 15000) // 15s
    return result
  }

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
    
    this.setCache(cacheKey, data, 15000)
    return data
  }

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
    
    this.setCache(cacheKey, data, 60000) // 1m
    return data
  }

  static async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    // userId from auth token on backend
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/portfolio`, { headers })
    const portfolioData = await this.handleResponse<UserPortfolioStock[] | { holdings: UserPortfolioStock[] }>(response)
    const holdings = Array.isArray(portfolioData) ? portfolioData : (portfolioData.holdings || [])
    // Backend has no timestamps; use now.
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

  /** @deprecated Use executeCurrencyTransaction. */
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
    
    this.clearCache()
  }

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
    
    this.clearCache()
  }

  static async getMaxSellAmount(userId: string, symbol: string): Promise<{ shares: number; value: number; price: number }> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/max-sell/${symbol}`, { headers })
    return this.handleResponse<{ shares: number; value: number; price: number }>(response)
  }

  static async getUserWatchlist(userId: string): Promise<string[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/watchlist`, { headers })
    
    const watchlistData = await this.handleResponse<string[] | { symbols: string[] }>(response)
    return Array.isArray(watchlistData) ? watchlistData : (watchlistData.symbols || [])
  }

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

  static async removeFromWatchlist(userId: string, symbol: string): Promise<void> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/watchlist/${symbol.toUpperCase()}`, {
      method: 'DELETE',
      headers
    })
    
    await this.handleResponse(response)
  }

  static async getTransactionHistory(userId: string): Promise<StockTransaction[]> {
    if (!auth.currentUser) throw new Error('User not authenticated')
    
    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/transactions`, { headers })
    return this.handleResponse<StockTransaction[]>(response)
  }

  static clearCache(): void {
    this.cache.clear()
  }

  static resetConnectionState(): void {
    this.connectionAttempted = false
    this.connectionFailed = false
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.priceUpdateCallbacks.clear()
  }

  private static async initializeSocket(): Promise<Socket | null> {
    if (this.connectionFailed) {
      return null
    }

    if (!this.socket && !this.connectionAttempted) {
      this.connectionAttempted = true
      
      try {
        // Check health before websocket.
        const healthUrl = this.baseUrl.replace('/api', '/health')
        const healthResponse = await fetch(healthUrl, { 
          method: 'GET'
        })
        
        if (!healthResponse.ok) {
          this.connectionFailed = true
          return null
        }
        
        const healthData = await healthResponse.json()
        
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

        this.socket.on('disconnect', () => {})

        this.socket.on('price_updates', (data: Record<string, StockData>) => {
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

        // Fail if not connected in 5s.
        setTimeout(() => {
          if (this.socket && !this.socket.connected) {
            this.connectionFailed = true
            this.socket.disconnect()
            this.socket = null
          }
        }, 5000)
      } catch (error) {
        // Log only in dev.
        if (process.env.NODE_ENV === 'development') {
          console.debug('WebSocket init failed:', error)
        }
        this.connectionFailed = true
        this.socket = null
      }
    }

    return this.socket
  }

  static subscribeToStockPrices(symbols: string[], callback: (symbol: string, data: StockData) => void): () => void {
    symbols.forEach(symbol => {
      if (!this.priceUpdateCallbacks.has(symbol)) {
        this.priceUpdateCallbacks.set(symbol, new Set())
      }

      const symbolCallback = (data: StockData) => callback(symbol, data)
      this.priceUpdateCallbacks.get(symbol)!.add(symbolCallback)
    })

    this.initializeSocket().then(socket => {
      if (socket) {
        socket.emit('subscribe_prices', { symbols })
      }
    }).catch(() => {
    })

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
