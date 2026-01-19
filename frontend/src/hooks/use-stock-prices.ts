/**
 * Real-time stock price hooks.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { StockAPI } from '@/lib/stock-api'
import { logger } from '@/lib/logger'

interface StockPriceUpdate {
  symbol: string
  price: number
  change: number
  changePercent: number
  timestamp: string
}

interface UseStockPricesOptions {
  symbols: string[]
  enabled?: boolean
  onError?: (error: string) => void
  onConnectionChange?: (connected: boolean) => void
}

interface UseStockPricesReturn {
  prices: Record<string, StockPriceUpdate>
  connected: boolean
  error: string | null
  getPrice: (symbol: string) => StockPriceUpdate | null
  getPrices: (symbols: string[]) => Record<string, StockPriceUpdate>
  reconnect: () => void
}

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

  const handlePriceUpdate = useCallback((symbol: string, data: { price: number; change?: number; changePercent?: number; timestamp?: number }) => {
    try {
      if (!data || typeof data.price !== 'number') {
        return
      }

      setPrices(prev => ({
        ...prev,
        [symbol]: {
          symbol,
          price: data.price,
          change: data.change || 0,
          changePercent: data.changePercent || 0,
          timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
        }
      }))
      
      if (!connected) {
        setConnected(true)
        setError(null)
        onConnectionChange?.(true)
      }
    } catch (err) {
      logger.error('Failed to process price update', {
        error: err instanceof Error ? err.message : 'Unknown error',
        symbols
      })
      setError('Failed to process price update')
      onError?.('Failed to process price update')
    }
  }, [connected, onConnectionChange, onError, symbols])

  const reconnect = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    
    setConnected(false)
    setError(null)
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
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
    }, 2000) // 2s
  }, [enabled, symbols, handlePriceUpdate, onError])

  const hasReceivedDataRef = useRef(false)
  
  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      hasReceivedDataRef.current = true
    }
  }, [prices])

  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }

    if (!enabled || symbols.length === 0) {
      setConnected(false)
      onConnectionChange?.(false)
      return
    }

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
      hasReceivedDataRef.current = false
      
      // Subscribe to price updates
      const unsubscribe = StockAPI.subscribeToStockPrices(symbols, handlePriceUpdate)
      unsubscribeRef.current = unsubscribe

      // Set a timeout to detect if connection is working
      connectionTimeoutRef.current = setTimeout(() => {
        if (!hasReceivedDataRef.current) {
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

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
      }
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

  const getPrice = useCallback((symbol: string): StockPriceUpdate | null => {
    if (!symbol || typeof symbol !== 'string') {
      return null
    }
    return prices[symbol] || null
  }, [prices])

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

export function useStockPrice(symbol: string, enabled = true) {
  const { connected, error, getPrice } = useStockPrices({ 
    symbols: symbol ? [symbol] : [], 
    enabled: enabled && !!symbol 
  })

  return {
    price: getPrice(symbol),
    connected,
    error,
  }
} 