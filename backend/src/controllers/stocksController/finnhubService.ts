/**
 * Finnhub Service
 * 
 * Handles all Finnhub API communication, caching, and data transformation.
 * 
 * @module controllers/stocksController/finnhubService
 */

import https from 'https'
import { StockData, MarketIndex } from '../../types/stocks'
import cache from '../../utils/cache'
import logger from '../../utils/logger'

// ============================================================================
// Configuration
// ============================================================================

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

export const CACHE_DURATIONS = {
  QUOTE: 30,
  PROFILE: 3600,
  SEARCH: 300,
  TRENDING: 60,
  MARKET_INDICES: 30,
  CANDLES: 300,
} as const

const REQUEST_BATCH_SIZE = 5

export const STOCK_SYMBOL_PATTERN = /^[A-Z0-9.^]{1,10}$/

export const TRENDING_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'ORCL',
  'BABA', 'V', 'MA', 'JPM', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'DIS'
] as const

export const MARKET_INDEX_SYMBOLS = ['SPY', 'DIA', 'QQQ'] as const

export const INDEX_NAME_MAPPING: Record<string, string> = {
  'SPY': 'S&P 500',
  'DIA': 'Dow Jones Industrial Average',
  'QQQ': 'NASDAQ-100'
}

export const TRADITIONAL_SYMBOL_MAPPING: Record<string, string> = {
  'SPY': '^GSPC',
  'DIA': '^DJI',
  'QQQ': '^IXIC'
}

export const LIMITS = {
  MAX_TRENDING: 50,
  DEFAULT_TRENDING: 10,
  MAX_SEARCH: 25,
  DEFAULT_SEARCH: 10,
  MAX_TRANSACTION_HISTORY: 100,
  DEFAULT_TRANSACTION_HISTORY: 50,
} as const

// ============================================================================
// Types
// ============================================================================

export interface FinnhubQuote {
  c: number; h: number; l: number; o: number; pc: number; t: number
}

export interface FinnhubProfile {
  name: string; ticker: string; marketCapitalization: number
  finnhubIndustry: string; weburl: string; logo: string
  phone: string; exchange: string; ipo: string; country: string; currency: string
}

export interface FinnhubCandle {
  o: number[]; h: number[]; l: number[]; c: number[]; v: number[]; t: number[]; s: string
}

export interface FinnhubSymbolLookup {
  count: number
  result: Array<{ description: string; displaySymbol: string; symbol: string; type: string }>
}

export interface AggregatedHolding {
  shares: number; totalInvested: number; avgPrice: number
}

// ============================================================================
// API Client
// ============================================================================

function validateFinnhubConfig(): void {
  if (!FINNHUB_API_KEY) {
    throw new Error('FINNHUB_API_KEY environment variable is not configured')
  }
}

async function callFinnhubAPI<T>(endpoint: string, cacheDuration?: number): Promise<T> {
  validateFinnhubConfig()

  const cacheKey = `finnhub:${endpoint}`
  const cachedData = cache.get<T>(cacheKey)
  if (cachedData) return cachedData

  return new Promise((resolve, reject) => {
    // Use header-based authentication to avoid exposing API key in URL/logs
    const url = `${FINNHUB_BASE_URL}${endpoint}`
    
    const request = https.get(url, {
      headers: { 
        'Content-Type': 'application/json', 
        'User-Agent': 'Sokin-Backend/1.0',
        'X-Finnhub-Token': FINNHUB_API_KEY!
      },
      timeout: 10000,
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Finnhub API error: ${res.statusCode} - ${res.statusMessage}`))
            return
          }
          const jsonData = JSON.parse(data)
          if (jsonData.error) {
            reject(new Error(`Finnhub API error: ${jsonData.error}`))
            return
          }
          if (cacheDuration) cache.set(cacheKey, jsonData, cacheDuration)
          resolve(jsonData)
        } catch (error) {
          reject(new Error(`Invalid response from Finnhub API: ${error instanceof Error ? error.message : 'Unknown error'}`))
        }
      })
    })
    
    request.on('error', (error) => reject(new Error(`Finnhub API unavailable: ${error.message}`)))
    request.on('timeout', () => { request.destroy(); reject(new Error('Finnhub API timeout')) })
  })
}

export async function processBatchedRequests<T>(
  requests: (() => Promise<T>)[],
  batchSize: number = REQUEST_BATCH_SIZE
): Promise<T[]> {
  const results: T[] = []
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(batch.map(request => request()))
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        // Log rejected promises to aid debugging while preserving graceful degradation
        logger.warn('Batch request failed', { 
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          batchIndex: i
        })
      }
    }
    
    if (i + batchSize < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

// ============================================================================
// Data Transformers
// ============================================================================

/**
 * Format market cap from millions to human-readable string
 * Finnhub returns marketCapitalization in millions
 */
function formatMarketCap(marketCapInMillions: number | undefined): string {
  if (!marketCapInMillions || marketCapInMillions <= 0) return 'N/A'
  
  const cap = marketCapInMillions * 1_000_000 // Convert from millions to actual value
  
  if (cap >= 1_000_000_000_000) {
    return `${(cap / 1_000_000_000_000).toFixed(2)}T`
  } else if (cap >= 1_000_000_000) {
    return `${(cap / 1_000_000_000).toFixed(2)}B`
  } else if (cap >= 1_000_000) {
    return `${(cap / 1_000_000).toFixed(2)}M`
  }
  return `${cap.toLocaleString()}`
}

function convertFinnhubToStockData(
  symbol: string, 
  quote: FinnhubQuote, 
  profile?: FinnhubProfile,
  candles?: FinnhubCandle
): StockData {
  const change = quote.c - quote.pc
  const changePercent = quote.pc !== 0 ? (change / quote.pc) * 100 : 0

  let weekHigh52 = quote.h, weekLow52 = quote.l, volume = 0, avgVolume = 0, weekChange52 = 0, chart: number[] = []

  if (candles && candles.s === 'ok' && candles.c.length > 0) {
    weekHigh52 = Math.max(...candles.h)
    weekLow52 = Math.min(...candles.l)
    volume = candles.v[candles.v.length - 1] || 0
    avgVolume = candles.v.reduce((sum, v) => sum + v, 0) / candles.v.length
    const yearAgoPrice = candles.c[0]
    if (yearAgoPrice && yearAgoPrice > 0) weekChange52 = ((quote.c - yearAgoPrice) / yearAgoPrice) * 100
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
    marketCap: formatMarketCap(profile?.marketCapitalization),
    peRatio: null,
    weekHigh52: Number(weekHigh52.toFixed(2)),
    weekLow52: Number(weekLow52.toFixed(2)),
    weekChange52: Number(weekChange52.toFixed(2)),
    chart
  }
}

export function convertQuoteToMarketIndex(
  quote: FinnhubQuote,
  displayName: string,
  traditionalSymbol: string
): MarketIndex {
  const change = quote.c - quote.pc
  const changePercent = quote.pc !== 0 ? (change / quote.pc) * 100 : 0
  return {
    symbol: traditionalSymbol,
    name: displayName,
    price: Number(quote.c.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2))
  }
}

export function createEmptyStockData(symbol: string, name?: string): StockData {
  return {
    symbol: symbol.toUpperCase(),
    name: name || symbol.toUpperCase(),
    price: 0, change: 0, changePercent: 0, volume: 0, avgVolume: 0,
    marketCap: 'N/A', peRatio: null, weekHigh52: 0, weekLow52: 0, weekChange52: 0, chart: []
  }
}

// ============================================================================
// Stock Data Service
// ============================================================================

export async function getOptimizedStockData(symbol: string): Promise<StockData | null> {
  try {
    // URL encode symbol to handle special characters (e.g., BRK.A, BRK.B)
    const encodedSymbol = encodeURIComponent(symbol)
    const [quote, profile] = await Promise.allSettled([
      callFinnhubAPI<FinnhubQuote>(`/quote?symbol=${encodedSymbol}`, CACHE_DURATIONS.QUOTE),
      callFinnhubAPI<FinnhubProfile>(`/stock/profile2?symbol=${encodedSymbol}`, CACHE_DURATIONS.PROFILE)
    ])

    if (quote.status === 'fulfilled' && quote.value && quote.value.c > 0) {
      const profileData = profile.status === 'fulfilled' ? profile.value : undefined
      return convertFinnhubToStockData(symbol, quote.value, profileData)
    }
    return null
  } catch (error) {
    // Log errors at debug level for troubleshooting while maintaining graceful degradation
    logger.debug('Failed to fetch optimized stock data', { 
      symbol, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    return null
  }
}

export async function getFullStockData(symbol: string, includeHistorical = true): Promise<StockData> {
  // URL encode symbol to handle special characters (e.g., BRK.A, BRK.B)
  const encodedSymbol = encodeURIComponent(symbol)
  const [quote, profile] = await Promise.allSettled([
    callFinnhubAPI<FinnhubQuote>(`/quote?symbol=${encodedSymbol}`, CACHE_DURATIONS.QUOTE),
    callFinnhubAPI<FinnhubProfile>(`/stock/profile2?symbol=${encodedSymbol}`, CACHE_DURATIONS.PROFILE)
  ])

  if (quote.status === 'fulfilled' && quote.value && quote.value.c > 0) {
    let candles: FinnhubCandle | undefined

    if (includeHistorical) {
      try {
        const toTimestamp = Math.floor(Date.now() / 1000)
        const fromTimestamp = toTimestamp - (365 * 24 * 60 * 60)
        const candleResult = await callFinnhubAPI<FinnhubCandle>(
          `/stock/candle?symbol=${encodedSymbol}&resolution=D&from=${fromTimestamp}&to=${toTimestamp}`,
          CACHE_DURATIONS.CANDLES
        )
        if (candleResult.s === 'ok') candles = candleResult
      } catch (e) {
        logger.debug('Failed to fetch candle data', { symbol, error: e instanceof Error ? e.message : 'Unknown' })
      }
    }

    const profileData = profile.status === 'fulfilled' ? profile.value : undefined
    return convertFinnhubToStockData(symbol, quote.value, profileData, candles)
  }

  throw new Error(`Failed to fetch stock data for ${symbol} from Finnhub API`)
}

export async function getMarketIndexQuote(symbol: string): Promise<FinnhubQuote | null> {
  try {
    // URL encode symbol to handle special characters
    const quote = await callFinnhubAPI<FinnhubQuote>(`/quote?symbol=${encodeURIComponent(symbol)}`, CACHE_DURATIONS.MARKET_INDICES)
    return quote.c > 0 ? quote : null
  } catch {
    return null
  }
}

export async function searchSymbols(query: string): Promise<FinnhubSymbolLookup> {
  return callFinnhubAPI<FinnhubSymbolLookup>(`/search?q=${encodeURIComponent(query)}`, CACHE_DURATIONS.SEARCH)
}

