"use client"

import React, { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, ChevronRight, Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { LoadingSpinner } from "../ui/loading-spinner"
import { useAuth } from "../../contexts/auth-context"
import { 
  StockAPI, 
  MarketIndex, 
  UserPortfolioStock, 
  formatPrice, 
  formatChange, 
  formatPercent 
} from "../../lib/stock-api"

// Simple sparkline component
const Sparkline: React.FC<{ data: number[]; positive: boolean }> = ({ data, positive }) => {
  if (!data || data.length === 0) return null

  const width = 60
  const height = 20
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        fill="none"
        stroke={positive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  )
}

export function StockMarket() {
  const { user } = useAuth()
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([])
  const [userPortfolio, setUserPortfolio] = useState<UserPortfolioStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStockData()
  }, [user])

  const loadStockData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [indices, portfolio] = await Promise.all([
        StockAPI.getMarketIndices(),
        user ? StockAPI.getUserPortfolio(user.uid) : Promise.resolve([])
      ])

      setMarketIndices(indices)
      setUserPortfolio(portfolio)
    } catch (err) {
      console.error('Error loading stock data:', err)
      setError('Failed to load stock market data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-dark border-cream/10">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-dark border-cream/10">
        <CardContent className="p-6">
          <div className="text-center text-cream/60">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Market Indices */}
      <Card className="bg-dark border-cream/10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-outfit text-cream">Market Indices</CardTitle>
            <ChevronRight className="h-4 w-4 text-cream/60" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {marketIndices.map((index) => (
              <div key={index.symbol} className="p-4 rounded-lg bg-cream/5 border border-cream/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-cream/80">{index.symbol}</p>
                    <p className="text-xs text-cream/60 truncate">{index.name}</p>
                  </div>
                  {index.changePercent >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-cream">{formatPrice(index.price)}</p>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      index.change >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {formatChange(index.change)}
                    </span>
                    <Badge variant={index.changePercent >= 0 ? "default" : "destructive"} className="text-xs">
                      {formatPercent(index.changePercent)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Portfolio */}
      {user && userPortfolio.length > 0 && (
        <Card className="bg-dark border-cream/10">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-outfit text-cream">Your Portfolio</CardTitle>
              <div className="text-sm text-cream/60">
                Total: {formatPrice(userPortfolio.reduce((sum, stock) => sum + stock.totalValue, 0))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {userPortfolio.slice(0, 4).map((stock) => (
                <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg bg-cream/5 border border-cream/10 hover:bg-cream/10 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-cream">{stock.symbol}</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-cream">{stock.symbol}</p>
                      <p className="text-xs text-cream/60 truncate max-w-32">{stock.name}</p>
                      <p className="text-xs text-cream/50">{stock.shares} shares</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-cream">{formatPrice(stock.totalValue)}</p>
                    <p className="text-sm text-cream/80">{formatPrice(stock.price)}</p>
                    <div className="flex items-center justify-end space-x-1">
                      <span className={`text-xs ${
                        stock.gainLoss >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {formatChange(stock.gainLoss)}
                      </span>
                      <span className={`text-xs ${
                        stock.gainLossPercent >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        ({formatPercent(stock.gainLossPercent)})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {userPortfolio.length > 4 && (
                <div className="text-center pt-2">
                  <p className="text-sm text-cream/60">
                    +{userPortfolio.length - 4} more stocks in your portfolio
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 