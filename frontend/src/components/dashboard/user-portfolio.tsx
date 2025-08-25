"use client"

import React, { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Activity, PieChart, ArrowUpDown, DollarSign, Clock, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { LoadingSpinner } from "../ui/loading-spinner"
import { Button } from "../ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { ScrollArea } from "../ui/scroll-area"
import { useAuth } from "../../contexts/auth-context"
import { toast } from "../ui/use-toast"
import { 
  StockAPI, 
  UserPortfolioStock,
  PortfolioHolding,
  StockTransaction,
  formatPrice, 
  formatChange, 
  formatPercent,
  formatVolume
} from "../../lib/stock-api"

interface UserPortfolioProps {
  className?: string
  onRefresh?: () => void
}

interface PortfolioSummary {
  totalValue: number
  totalGainLoss: number
  totalGainLossPercent: number
  totalInvested: number
  dayChange: number
  dayChangePercent: number
}

export const UserPortfolio: React.FC<UserPortfolioProps> = ({ className, onRefresh }) => {
  const { user } = useAuth()
  const [userPortfolio, setUserPortfolio] = useState<UserPortfolioStock[]>([])
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([])
  const [recentTransactions, setRecentTransactions] = useState<StockTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sortField, setSortField] = useState<'symbol' | 'totalValue' | 'gainLoss' | 'gainLossPercent'>('totalValue')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (user) {
      loadPortfolioData()
    } else {
      // Clear data when user logs out
      setUserPortfolio([])
      setPortfolioHoldings([])
      setRecentTransactions([])
      setLoading(false)
      setError(null)
    }
  }, [user])

  const loadPortfolioData = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)
      
      const [portfolio, holdings, transactions] = await Promise.all([
        StockAPI.getUserPortfolio(user.uid),
        StockAPI.getPortfolioHoldings(user.uid),
        StockAPI.getTransactionHistory(user.uid)
      ])

      setUserPortfolio(portfolio || [])
      setPortfolioHoldings(holdings || [])
      setRecentTransactions(transactions?.slice(0, 10) || [])
    } catch (err) {
      console.error('Error loading portfolio data:', err)
      setError('Failed to load portfolio data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadPortfolioData()
      onRefresh?.()
      toast({
        title: "Portfolio Refreshed",
        description: "Your portfolio data has been updated.",
      })
    } catch (err) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh portfolio data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  const calculatePortfolioSummary = (): PortfolioSummary => {
    if (!userPortfolio.length) {
      return {
        totalValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        totalInvested: 0,
        dayChange: 0,
        dayChangePercent: 0
      }
    }

    const totalValue = userPortfolio.reduce((sum, stock) => sum + stock.totalValue, 0)
    const totalGainLoss = userPortfolio.reduce((sum, stock) => sum + stock.gainLoss, 0)
    const totalInvested = totalValue - totalGainLoss
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0
    const dayChange = userPortfolio.reduce((sum, stock) => sum + (stock.change * stock.shares), 0)
    const dayChangePercent = totalValue > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0

    return {
      totalValue,
      totalGainLoss,
      totalGainLossPercent,
      totalInvested,
      dayChange,
      dayChangePercent
    }
  }

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-40" />
    return sortDirection === 'asc' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
  }

  const sortedPortfolio = React.useMemo(() => {
    return [...userPortfolio].sort((a, b) => {
      let aValue: number | string = 0
      let bValue: number | string = 0

      switch (sortField) {
        case 'symbol':
          aValue = a.symbol
          bValue = b.symbol
          break
        case 'totalValue':
          aValue = a.totalValue
          bValue = b.totalValue
          break
        case 'gainLoss':
          aValue = a.gainLoss
          bValue = b.gainLoss
          break
        case 'gainLossPercent':
          aValue = a.gainLossPercent
          bValue = b.gainLossPercent
          break
        default:
          aValue = a.totalValue
          bValue = b.totalValue
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
  }, [userPortfolio, sortField, sortDirection])

  const portfolioSummary = calculatePortfolioSummary()

  if (!user) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="bg-dark border-cream/10">
          <CardContent className="p-6 text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50 text-cream/60" />
            <p className="text-cream/60">Sign in to view your portfolio</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="bg-dark border-cream/10">
          <CardContent className="p-6 text-center">
            <LoadingSpinner size="lg" />
            <p className="text-cream/60 mt-2">Loading portfolio...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="bg-dark border-cream/10">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p className="text-cream/60 mb-4">{error}</p>
            <Button onClick={loadPortfolioData} variant="outline" size="sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Portfolio Summary */}
      <Card className="bg-dark border-cream/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-outfit text-cream">Portfolio Overview</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-cream/60 hover:text-cream"
            >
              {refreshing ? <LoadingSpinner size="sm" /> : <Activity className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-cream/60">Total Value</p>
              <p className="text-lg font-semibold text-cream">{formatPrice(portfolioSummary.totalValue)}</p>
            </div>
            <div>
              <p className="text-xs text-cream/60">Total Gain/Loss</p>
              <div className="flex items-center space-x-2">
                <p className={`text-lg font-semibold ${
                  portfolioSummary.totalGainLoss > 0 ? 'text-green-500' : 
                  portfolioSummary.totalGainLoss < 0 ? 'text-red-500' : 
                  'text-cream/60'
                }`}>
                  {formatChange(portfolioSummary.totalGainLoss)}
                </p>
                <Badge 
                  variant={
                    portfolioSummary.totalGainLossPercent > 0 ? "default" : 
                    portfolioSummary.totalGainLossPercent < 0 ? "destructive" : 
                    "secondary"
                  }
                  className="text-xs"
                >
                  {formatPercent(portfolioSummary.totalGainLossPercent)}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-cream/60">Invested</p>
              <p className="text-sm text-cream/80">{formatPrice(portfolioSummary.totalInvested)}</p>
            </div>
            <div>
              <p className="text-xs text-cream/60">Day Change</p>
              <div className="flex items-center space-x-1">
                <p className={`text-sm font-medium ${
                  portfolioSummary.dayChange > 0 ? 'text-green-500' : 
                  portfolioSummary.dayChange < 0 ? 'text-red-500' : 
                  'text-cream/60'
                }`}>
                  {formatChange(portfolioSummary.dayChange)}
                </p>
                <span className={`text-xs ${
                  portfolioSummary.dayChangePercent > 0 ? 'text-green-500' : 
                  portfolioSummary.dayChangePercent < 0 ? 'text-red-500' : 
                  'text-cream/60'
                }`}>
                  ({formatPercent(portfolioSummary.dayChangePercent)})
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holdings */}
      <Card className="bg-dark border-cream/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-outfit text-cream">
            Holdings {userPortfolio.length > 0 && `(${userPortfolio.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {userPortfolio.length === 0 ? (
            <div className="text-center py-8 text-cream/60 px-6">
              <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No holdings yet</p>
              <p className="text-xs mt-1">Start trading to build your portfolio</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="px-1">
                <Table>
                  <TableHeader>
                    <TableRow className="border-cream/10">
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream"
                        onClick={() => handleSort('symbol')}
                      >
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium">Stock</span>
                          {getSortIcon('symbol')}
                        </div>
                      </TableHead>
                      <TableHead className="text-cream/80 text-center">
                        <span className="text-sm font-medium">Shares</span>
                      </TableHead>
                      <TableHead className="text-cream/80 text-right">
                        <span className="text-sm font-medium">Current Price</span>
                      </TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('totalValue')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-sm font-medium">Total Value</span>
                          {getSortIcon('totalValue')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('gainLoss')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-sm font-medium">Gain/Loss</span>
                          {getSortIcon('gainLoss')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('gainLossPercent')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span className="text-sm font-medium">Return %</span>
                          {getSortIcon('gainLossPercent')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPortfolio.map((stock) => (
                      <TableRow key={stock.symbol} className="border-cream/10 hover:bg-cream/5">
                        <TableCell>
                          <div>
                            <p className="font-semibold text-cream text-sm">{stock.symbol}</p>
                            <p className="text-xs text-cream/60 truncate max-w-[100px]">{stock.name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <p className="font-medium text-cream text-sm">{stock.shares}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-medium text-cream text-sm">{formatPrice(stock.price)}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-semibold text-cream text-sm">{formatPrice(stock.totalValue)}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className={`font-medium text-sm ${
                            stock.gainLoss > 0 ? 'text-green-500' : 
                            stock.gainLoss < 0 ? 'text-red-500' : 
                            'text-cream/60'
                          }`}>
                            {formatChange(stock.gainLoss)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={
                              stock.gainLossPercent > 0 ? "default" : 
                              stock.gainLossPercent < 0 ? "destructive" : 
                              "secondary"
                            }
                            className="text-xs font-medium"
                          >
                            {formatPercent(stock.gainLossPercent)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-dark border-cream/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-outfit text-cream">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-6 text-cream/60 px-6">
              <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 px-3 pb-2">
                {recentTransactions.map((transaction, index) => (
                  <div key={transaction.id || index} className="flex items-center justify-between p-2 rounded bg-cream/5">
                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant={transaction.transactionType === 'buy' ? 'default' : 'destructive'}
                        className="text-xs font-medium"
                      >
                        {transaction.transactionType.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="font-medium text-cream text-sm">{transaction.symbol}</p>
                        <p className="text-xs text-cream/60">
                          {transaction.shares} shares @ {formatPrice(transaction.pricePerShare)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-cream text-sm">{formatPrice(transaction.totalAmount)}</p>
                      <p className="text-xs text-cream/60">
                        {transaction.timestamp ? new Date(transaction.timestamp).toLocaleDateString() : 
                         new Date(transaction.transactionDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 