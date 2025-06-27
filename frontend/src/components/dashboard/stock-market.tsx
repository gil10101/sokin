"use client"

import React, { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, ChevronRight, Activity, RefreshCw, DollarSign, PieChart, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { LoadingSpinner } from "../ui/loading-spinner"
import { Button } from "../ui/button"
import { useAuth } from "../../contexts/auth-context"
import { useStockPrices } from "../../hooks/use-stock-prices"
import { 
  StockAPI, 
  MarketIndex, 
  UserPortfolioStock, 
  PortfolioHolding,
  StockTransaction,
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

// Portfolio Summary Component
const PortfolioSummary: React.FC<{ portfolio: UserPortfolioStock[]; connected?: boolean }> = ({ portfolio, connected }) => {
  const totalValue = portfolio.reduce((sum, stock) => sum + stock.totalValue, 0)
  const totalGainLoss = portfolio.reduce((sum, stock) => sum + stock.gainLoss, 0)
  const totalGainLossPercent = totalValue > 0 ? (totalGainLoss / (totalValue - totalGainLoss)) * 100 : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className="bg-dark border-cream/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-cream/60" />
              <div>
                <p className="text-sm text-cream/60">Total Value</p>
                <p className="text-lg font-semibold text-cream">{formatPrice(totalValue)}</p>
              </div>
            </div>
            {connected && (
              <div className="flex items-center space-x-1 text-green-500 text-xs">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-dark border-cream/10">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            {totalGainLoss >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="text-sm text-cream/60">Total Gain/Loss</p>
              <p className={`text-lg font-semibold ${totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatChange(totalGainLoss)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-dark border-cream/10">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-cream/60" />
            <div>
              <p className="text-sm text-cream/60">Total Return</p>
              <Badge 
                variant={totalGainLossPercent >= 0 ? "default" : "destructive"}
                className="text-sm font-semibold"
              >
                {formatPercent(totalGainLossPercent)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function StockMarket() {
  const { user } = useAuth()
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([])
  const [userPortfolio, setUserPortfolio] = useState<UserPortfolioStock[]>([])
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([])
  const [recentTransactions, setRecentTransactions] = useState<StockTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  // Real-time price updates for portfolio symbols
  const portfolioSymbols = React.useMemo(() => {
    return userPortfolio.map(stock => stock.symbol)
  }, [userPortfolio])

  const { prices: realTimePrices, connected: priceConnected } = useStockPrices({
    symbols: portfolioSymbols,
    enabled: portfolioSymbols.length > 0,
  })

  useEffect(() => {
    loadStockData()
  }, [user])

  const loadStockData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Loading stock market data...')
      
      // Load market indices (always available)
      console.log('Fetching market indices...')
      const indicesPromise = StockAPI.getMarketIndices()
      
      // Load user-specific data if authenticated
      let portfolioPromise: Promise<UserPortfolioStock[]> = Promise.resolve([])
      let holdingsPromise: Promise<PortfolioHolding[]> = Promise.resolve([])
      let transactionsPromise: Promise<StockTransaction[]> = Promise.resolve([])
      
      if (user) {
        console.log('User authenticated, fetching portfolio data for:', user.uid)
        portfolioPromise = StockAPI.getUserPortfolio(user.uid)
        holdingsPromise = StockAPI.getPortfolioHoldings(user.uid)
        transactionsPromise = StockAPI.getTransactionHistory(user.uid)
      } else {
        console.log('User not authenticated, skipping portfolio data')
      }

      const [indices, portfolio, holdings, transactions] = await Promise.all([
        indicesPromise,
        portfolioPromise,
        holdingsPromise,
        transactionsPromise
      ])

      console.log('Market indices loaded:', indices.length, 'items')
      console.log('Portfolio loaded:', portfolio.length, 'items')
      console.log('Holdings loaded:', holdings.length, 'items')
      console.log('Transactions loaded:', transactions.length, 'items')

      setMarketIndices(indices)
      setUserPortfolio(portfolio)
      setPortfolioHoldings(holdings)
      setRecentTransactions(transactions.slice(0, 5)) // Show last 5 transactions


    } catch (err) {
      console.error('Error loading stock data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      
      // Check if it's a rate limiting error
      if (errorMessage.includes('Rate limited')) {
        setError('Rate limited: Too many requests. Data will be cached to reduce API calls.')
      } else if (errorMessage.includes('User not authenticated')) {
        setError('Please sign in to view your complete stock portfolio.')
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        setError('Stock service is temporarily unavailable. Please check your connection and try again.')
      } else {
        setError(`Failed to load stock market data: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
      setIsRetrying(false)
    }
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    await loadStockData()
  }

  const handleClearCache = () => {
    StockAPI.clearCache()
    setIsRetrying(true)
    loadStockData()
  }

  // Function to update portfolio stocks with real-time prices
  const updatePortfolioWithRealTimePrices = (portfolio: UserPortfolioStock[]): UserPortfolioStock[] => {
    return portfolio.map(stock => {
      const realTimePrice = realTimePrices[stock.symbol]
      if (realTimePrice) {
        const newTotalValue = realTimePrice.price * stock.shares
        const newGainLoss = (realTimePrice.price - stock.purchasePrice) * stock.shares
        const newGainLossPercent = ((realTimePrice.price - stock.purchasePrice) / stock.purchasePrice) * 100
        
        return {
          ...stock,
          price: realTimePrice.price,
          change: realTimePrice.change,
          changePercent: realTimePrice.changePercent,
          totalValue: newTotalValue,
          gainLoss: newGainLoss,
          gainLossPercent: newGainLossPercent,
        }
      }
      return stock
    })
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
          <div className="text-center text-cream/60 space-y-4">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{error}</p>
            <div className="flex justify-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRetry}
                disabled={isRetrying}
                className="text-cream/80 hover:text-cream"
              >
                {isRetrying ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Retry
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearCache}
                className="text-cream/80 hover:text-cream"
              >
                Clear Cache & Retry
              </Button>
            </div>
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
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRetry}
                disabled={isRetrying}
                className="text-cream/60 hover:text-cream/80 p-1"
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              </Button>
              <ChevronRight className="h-4 w-4 text-cream/60" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {marketIndices.length > 0 ? (
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
          ) : (
            <div className="text-center py-8 text-cream/60">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No market data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Portfolio Section */}
      {user && (
        <>
          {/* Portfolio Summary */}
          {userPortfolio.length > 0 && (
            <PortfolioSummary portfolio={updatePortfolioWithRealTimePrices(userPortfolio)} connected={priceConnected} />
          )}

          {/* Portfolio Holdings */}
          <Card className="bg-dark border-cream/10">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-outfit text-cream">
                  Your Portfolio {userPortfolio.length > 0 && `(${userPortfolio.length} holdings)`}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <PieChart className="h-4 w-4 text-cream/60" />
                  <ChevronRight className="h-4 w-4 text-cream/60" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {userPortfolio.length > 0 ? (
                <div className="space-y-3">
                  {updatePortfolioWithRealTimePrices(userPortfolio).map((stock) => (
                    <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-lg bg-cream/5 border border-cream/10">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="font-medium text-cream">{stock.symbol}</p>
                          <p className="text-xs text-cream/60 truncate max-w-32">{stock.name}</p>
                        </div>
                        <div className="text-sm text-cream/70">
                          {stock.shares} shares
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-cream">{formatPrice(stock.price)}</p>
                          <p className={`text-xs ${stock.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatPercent(stock.changePercent)}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-sm font-semibold text-cream">{formatPrice(stock.totalValue)}</p>
                          <p className={`text-xs ${stock.gainLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatChange(stock.gainLoss)} ({formatPercent(stock.gainLossPercent)})
                          </p>
                        </div>
                        
                        {stock.gainLoss >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-cream/60">
                  <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Your portfolio is empty</p>
                  <p className="text-xs text-cream/40 mt-1">Start building your portfolio by searching and buying stocks</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          {recentTransactions.length > 0 && (
            <Card className="bg-dark border-cream/10">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-outfit text-cream">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg bg-cream/5 border border-cream/10">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          transaction.transactionType === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {transaction.transactionType === 'buy' ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-cream">
                            {transaction.transactionType.toUpperCase()} {transaction.symbol}
                          </p>
                          <p className="text-xs text-cream/60">
                            {transaction.shares} shares at {formatPrice(transaction.pricePerShare)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm font-medium text-cream">
                          {formatPrice(transaction.totalAmount)}
                        </p>
                        <p className="text-xs text-cream/60">
                          {transaction.timestamp ? new Date(transaction.timestamp).toLocaleDateString() : 
                           new Date(transaction.transactionDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Sign-in prompt for unauthenticated users */}
      {!user && (
        <Card className="bg-dark border-cream/10">
          <CardContent className="p-6">
            <div className="text-center text-cream/60 space-y-4">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <div>
                <p className="text-lg font-medium text-cream mb-2">Portfolio Tracking</p>
                <p className="text-sm">Sign in to track your stock portfolio and investment performance</p>
              </div>
              <Button 
                variant="outline" 
                className="text-cream/80 hover:text-cream border-cream/20 hover:border-cream/40"
              >
                Sign In to View Portfolio
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 