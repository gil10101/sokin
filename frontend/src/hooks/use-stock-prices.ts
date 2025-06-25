/**
 * @fileoverview Custom React hooks for real-time stock price updates
 * Provides WebSocket-based real-time stock price monitoring with error handling
 * 
 * @version 1.0.0
 * @author Sokin Team
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { StockAPI } from '../lib/stock-api'

/**
 * Stock price update data structure
 */
interface StockPriceUpdate {
  symbol: string
  price: number
  change: number
  changePercent: number
  timestamp: string
}

/**
 * Configuration options for the useStockPrices hook
 */
interface UseStockPricesOptions {
  /** Array of stock symbols to monitor */
  symbols: string[]
  /** Whether to enable real-time updates (default: true) */
  enabled?: boolean
  /** Custom error handler for connection issues */
  onError?: (error: string) => void
  /** Custom connection status handler */
  onConnectionChange?: (connected: boolean) => void
}

/**
 * Return type for the useStockPrices hook
 */
interface UseStockPricesReturn {
  /** Real-time price data for subscribed symbols */
  prices: Record<string, StockPriceUpdate>
  /** WebSocket connection status */
  connected: boolean
  /** Current error message, if any */
  error: string | null
  /** Get price data for a specific symbol */
  getPrice: (symbol: string) => StockPriceUpdate | null
  /** Get price data for multiple symbols */
  getPrices: (symbols: string[]) => Record<string, StockPriceUpdate>
  /** Manually reconnect to WebSocket */
  reconnect: () => void
}

/**
 * Custom hook for real-time stock price updates via WebSocket
 * 
 * Features:
 * - Real-time price updates via WebSocket connection
 * - Automatic connection management
 * - Error handling and retry logic
 * - Connection timeout detection
 * - Clean subscription management
 * 
 * @param options - Hook configuration options
 * @returns Object containing price data, connection status, and utility functions
 * 
 * @example
 * Basic usage:
 * ```typescript
 * const { prices, connected, error } = useStockPrices({
 *   symbols: ['AAPL', 'GOOGL', 'MSFT'],
 *   enabled: true
 * })
 * 
 * if (error) {
 *   console.error('Price updates failed:', error)
 * }
 * 
 * if (connected) {
 *   console.log('AAPL price:', prices['AAPL']?.price)
 * }
 * ```
 * 
 * @example
 * With custom error handling:
 * ```typescript
 * const { prices, getPrice } = useStockPrices({
 *   symbols: ['AAPL'],
 *   onError: (error) => toast.error(`Price updates failed: ${error}`),
 *   onConnectionChange: (connected) => setConnectionStatus(connected)
 * })
 * 
 * const aaplPrice = getPrice('AAPL')
 * ```
 * 
 * @security
 * - WebSocket connection includes authentication token when available
 * - Validates symbol format before subscribing
 * - Limits number of concurrent subscriptions
 */
export function useStockPrices({ 
  symbols, 
  enabled = true, 
  onError,
  onConnectionChange 
}: UseStockPricesOptions): UseStockPricesReturn {
  const [prices, setPrices] = useState<Record<string, StockPriceUpdate>>({})
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Handle incoming price update from WebSocket
   * Updates local state and triggers re-render
   * 
   * @param symbol - Stock symbol
   * @param data - Price update data
   */
  const handlePriceUpdate = useCallback((symbol: string, data: any) => {
    try {
      // Validate incoming data
      if (!data || typeof data.price !== 'number') {
        console.warn(`Invalid price data received for ${symbol}:`, data)
        return
      }

      setPrices(prev => ({
        ...prev,
        [symbol]: {
          symbol,
          price: data.price,
          change: data.change || 0,
          changePercent: data.changePercent || 0,
          timestamp: data.timestamp || new Date().toISOString(),
        }
      }))
      
      // Set connected to true when we receive valid data
      if (!connected) {
        setConnected(true)
        setError(null)
        onConnectionChange?.(true)
      }
    } catch (err) {
      console.error('Error processing price update:', err)
      setError('Failed to process price update')
      onError?.('Failed to process price update')
    }
  }, [connected, onConnectionChange, onError])

  /**
   * Manually reconnect to WebSocket
   * Useful for retry after connection failures
   */
  const reconnect = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    
    setConnected(false)
    setError(null)
    
    // Clear any existing timeouts
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    // Retry connection after a short delay
    reconnectTimeoutRef.current = setTimeout(() => {
      if (enabled && symbols.length > 0) {
        try {
          const unsubscribe = StockAPI.subscribeToStockPrices(symbols, handlePriceUpdate)
          unsubscribeRef.current = unsubscribe
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to reconnect'
          setError(errorMsg)
          onError?.(errorMsg)
        }
      }
    }, 2000) // 2 second delay
  }, [enabled, symbols, handlePriceUpdate, onError])

  // Main effect for managing WebSocket subscription
  useEffect(() => {
    // Clean up any existing connections
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }

    // Don't connect if disabled or no symbols
    if (!enabled || symbols.length === 0) {
      setConnected(false)
      onConnectionChange?.(false)
      return
    }

    // Validate symbols format
    const invalidSymbols = symbols.filter(symbol => 
      !symbol || typeof symbol !== 'string' || !/^[A-Z^]{1,10}$/.test(symbol)
    )
    
    if (invalidSymbols.length > 0) {
      const errorMsg = `Invalid stock symbols: ${invalidSymbols.join(', ')}`
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    // Limit number of symbols to prevent abuse
    if (symbols.length > 20) {
      const errorMsg = 'Too many symbols (maximum 20 allowed)'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    try {
      setError(null)
      
      // Subscribe to price updates
      const unsubscribe = StockAPI.subscribeToStockPrices(symbols, handlePriceUpdate)
      unsubscribeRef.current = unsubscribe

      // Set a timeout to detect if connection is working
      connectionTimeoutRef.current = setTimeout(() => {
        if (Object.keys(prices).length === 0) {
          setConnected(false)
          onConnectionChange?.(false)
          const errorMsg = 'Real-time price updates not available'
          setError(errorMsg)
          onError?.(errorMsg)
        }
      }, 10000) // 10 second timeout

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current)
          connectionTimeoutRef.current = null
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
        setConnected(false)
        onConnectionChange?.(false)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to price updates'
      setError(errorMsg)
      onError?.(errorMsg)
      setConnected(false)
      onConnectionChange?.(false)
    }
  }, [symbols, enabled, handlePriceUpdate, onError, onConnectionChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  /**
   * Get price data for a specific symbol
   * 
   * @param symbol - Stock symbol to get price for
   * @returns Price update data or null if not available
   * 
   * @example
   * ```typescript
   * const aaplPrice = getPrice('AAPL')
   * if (aaplPrice) {
   *   console.log(`AAPL: $${aaplPrice.price} (${aaplPrice.changePercent}%)`)
   * }
   * ```
   */
  const getPrice = useCallback((symbol: string): StockPriceUpdate | null => {
    if (!symbol || typeof symbol !== 'string') {
      return null
    }
    return prices[symbol] || null
  }, [prices])

  /**
   * Get price data for multiple symbols
   * 
   * @param symbolList - Array of stock symbols
   * @returns Object mapping symbols to price data (only includes available data)
   * 
   * @example
   * ```typescript
   * const portfolioPrices = getPrices(['AAPL', 'GOOGL', 'MSFT'])
   * Object.entries(portfolioPrices).forEach(([symbol, data]) => {
   *   console.log(`${symbol}: $${data.price}`)
   * })
   * ```
   */
  const getPrices = useCallback((symbolList: string[]): Record<string, StockPriceUpdate> => {
    if (!Array.isArray(symbolList)) {
      return {}
    }
    
    const result: Record<string, StockPriceUpdate> = {}
    symbolList.forEach(symbol => {
      if (typeof symbol === 'string' && prices[symbol]) {
        result[symbol] = prices[symbol]
      }
    })
    return result
  }, [prices])

  return {
    prices,
    connected,
    error,
    getPrice,
    getPrices,
    reconnect,
  }
}

/**
 * Simplified hook for monitoring a single stock price
 * Convenience wrapper around useStockPrices for single symbol use cases
 * 
 * @param symbol - Stock symbol to monitor
 * @param enabled - Whether to enable real-time updates (default: true)
 * @returns Object containing price data, connection status, and error
 * 
 * @example
 * ```typescript
 * const { price, connected, error } = useStockPrice('AAPL')
 * 
 * if (price) {
 *   console.log(`AAPL: $${price.price} (${price.changePercent >= 0 ? '+' : ''}${price.changePercent}%)`)
 * }
 * 
 * if (error) {
 *   console.error('Failed to get AAPL price:', error)
 * }
 * ```
 */
export function useStockPrice(symbol: string, enabled = true) {
  const { prices, connected, error, getPrice } = useStockPrices({ 
    symbols: symbol ? [symbol] : [], 
    enabled: enabled && !!symbol 
  })

  return {
    /** Price data for the specified symbol */
    price: getPrice(symbol),
    /** WebSocket connection status */
    connected,
    /** Current error message, if any */
    error,
  }
} 