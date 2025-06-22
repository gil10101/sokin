// Stock API service
import { auth } from './firebase'

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

// Simple cache interface
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class StockAPI {
  private static baseUrl = (() => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL
    if (envUrl) {
      // If environment URL doesn't end with /api, add it
      return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
    }
    return 'http://localhost:5001/api'
  })()

  // Simple in-memory cache
  private static cache = new Map<string, CacheEntry<any>>()

  // Helper method to get authentication headers
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

  // Enhanced fetch with retry logic and rate limit handling
  private static async fetchWithRetry(
    url: string, 
    options: RequestInit = {}, 
    maxRetries = 3
  ): Promise<Response> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options)
        
        // If it's a rate limit error, handle it specially
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}))
          const retryAfter = errorData.retryAfter || Math.pow(2, attempt) // Use exponential backoff if no retryAfter
          
          if (attempt < maxRetries) {
            console.warn(`Rate limited. Retrying in ${retryAfter} seconds... (attempt ${attempt + 1}/${maxRetries + 1})`)
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
            continue
          }
          
          throw new Error(`Rate limited: ${errorData.error || 'Too many requests'}. Please try again in ${retryAfter} seconds.`)
        }
        
        return response
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on non-network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
            console.warn(`Network error. Retrying in ${delay/1000} seconds... (attempt ${attempt + 1}/${maxRetries + 1})`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
        }
        
        // For other errors, throw immediately
        throw error
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }

  // Check cache for data
  private static getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  // Store data in cache
  private static setCache<T>(key: string, data: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    })
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }
    const data = await response.json()
    if (!data.success) {
      throw new Error(`API Error: ${data.error || 'Unknown error'}`)
    }
    return data.data
  }

  static async getMarketIndices(): Promise<MarketIndex[]> {
    const cacheKey = 'market-indices'
    const cached = this.getFromCache<MarketIndex[]>(cacheKey)
    if (cached) {
      console.log('Using cached market indices')
      return cached
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/market-indices`)
    const data = await this.handleResponse<MarketIndex[]>(response)
    
    // Cache for 2 minutes
    this.setCache(cacheKey, data, 120000)
    return data
  }

  static async getTrendingStocks(): Promise<StockData[]> {
    const cacheKey = 'trending-stocks'
    const cached = this.getFromCache<StockData[]>(cacheKey)
    if (cached) {
      console.log('Using cached trending stocks')
      return cached
    }

    const url = `${this.baseUrl}/stocks/trending`
    console.log('Calling stocks API:', url)
    console.log('Base URL:', this.baseUrl)
    const response = await this.fetchWithRetry(url)
    const data = await this.handleResponse<StockData[]>(response)
    
    // Cache for 1 minute
    this.setCache(cacheKey, data, 60000)
    return data
  }

  static async getUserPortfolio(userId: string): Promise<UserPortfolioStock[]> {
    const cacheKey = `portfolio-${userId}`
    const cached = this.getFromCache<UserPortfolioStock[]>(cacheKey)
    if (cached) {
      console.log('Using cached portfolio')
      return cached
    }

    const headers = await this.getAuthHeaders()
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/portfolio/${userId}`, {
      headers
    })
    const portfolio = await this.handleResponse<UserPortfolioStock[]>(response)
    const sortedPortfolio = portfolio.sort((a, b) => b.totalValue - a.totalValue)
    
    // Cache for 30 seconds (portfolio data changes frequently)
    this.setCache(cacheKey, sortedPortfolio, 30000)
    return sortedPortfolio
  }

  static async getStockData(symbol: string): Promise<StockData> {
    const cacheKey = `stock-${symbol}`
    const cached = this.getFromCache<StockData>(cacheKey)
    if (cached) {
      console.log(`Using cached data for ${symbol}`)
      return cached
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/stock/${symbol}`)
    const data = await this.handleResponse<StockData>(response)
    
    // Cache for 1 minute
    this.setCache(cacheKey, data, 60000)
    return data
  }

  static async searchStocks(query: string): Promise<StockData[]> {
    if (!query.trim()) {
      return []
    }
    
    const cacheKey = `search-${query.toLowerCase()}`
    const cached = this.getFromCache<StockData[]>(cacheKey)
    if (cached) {
      console.log(`Using cached search results for "${query}"`)
      return cached
    }
    
    const response = await this.fetchWithRetry(`${this.baseUrl}/stocks/search?q=${encodeURIComponent(query)}`)
    const data = await this.handleResponse<StockData[]>(response)
    
    // Cache search results for 5 minutes
    this.setCache(cacheKey, data, 300000)
    return data
  }

  // Clear cache (useful for debugging or force refresh)
  static clearCache(): void {
    this.cache.clear()
    console.log('Stock API cache cleared')
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