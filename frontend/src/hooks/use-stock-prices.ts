/**
 * Periodic stock price updates.
 *
 * Polls the backend quote API every 30 seconds via React Query (matching the
 * backend's 30s quote cache TTL). Replaces the old socket.io subscription,
 * which targeted a websocket server that no longer exists.
 */

import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StockAPI } from '@/lib/stock-api'

const REFRESH_INTERVAL_MS = 30_000
const VALID_SYMBOL = /^[A-Z0-9.^-]{1,10}$/

/**
 * Stable identity for the empty case. Returning a fresh {} on every render
 * makes every consumer callback that closes over `prices` a new function,
 * which re-runs their effects and can loop.
 */
const NO_PRICES: Record<string, StockPriceUpdate> = {}

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
}: UseStockPricesOptions): UseStockPricesReturn {
  const validSymbols = useMemo(
    () => [...new Set(symbols.filter(s => VALID_SYMBOL.test(s)))].sort(),
    [symbols]
  )

  const query = useQuery({
    queryKey: ['stock-prices', validSymbols],
    enabled: enabled && validSymbols.length > 0,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: REFRESH_INTERVAL_MS,
    queryFn: async (): Promise<Record<string, StockPriceUpdate>> => {
      const results = await Promise.allSettled(
        validSymbols.map(symbol => StockAPI.getStockData(symbol))
      )

      const prices: Record<string, StockPriceUpdate> = {}
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && typeof result.value?.price === 'number') {
          const symbol = validSymbols[index]
          prices[symbol] = {
            symbol,
            price: result.value.price,
            change: result.value.change ?? 0,
            changePercent: result.value.changePercent ?? 0,
            timestamp: new Date().toISOString(),
          }
        }
      })
      return prices
    },
  })

  const prices = query.data ?? NO_PRICES

  const getPrice = useCallback(
    (symbol: string) => prices[symbol] ?? null,
    [prices]
  )

  const getPrices = useCallback(
    (requested: string[]) => {
      const subset: Record<string, StockPriceUpdate> = {}
      for (const symbol of requested) {
        if (prices[symbol]) subset[symbol] = prices[symbol]
      }
      return subset
    },
    [prices]
  )

  return {
    prices,
    connected: query.isSuccess,
    error: query.isError ? 'Price updates unavailable' : null,
    getPrice,
    getPrices,
    reconnect: query.refetch,
  }
}
