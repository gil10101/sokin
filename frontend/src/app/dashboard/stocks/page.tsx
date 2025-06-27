"use client"

import React, { useState, useEffect } from "react"
import { ChevronRight, Search, TrendingUp, TrendingDown, Activity, ArrowUpDown, Plus, Minus, Star, DollarSign } from "lucide-react"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { UserPortfolio } from "../../../components/dashboard/user-portfolio"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Badge } from "../../../components/ui/badge"
import { Input } from "../../../components/ui/input"
import { LoadingSpinner } from "../../../components/ui/loading-spinner"
import { Button } from "../../../components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog"
import { Label } from "../../../components/ui/label"
import { ScrollArea } from "../../../components/ui/scroll-area"
import { useAuth } from "../../../contexts/auth-context"
import { toast } from "../../../components/ui/use-toast"
import { useStockPrices } from "../../../hooks/use-stock-prices"
import { 
  StockAPI, 
  StockData,
  CurrencyTransaction,
  formatPrice, 
  formatChange, 
  formatPercent,
  formatVolume
} from "../../../lib/stock-api"

// Simple sparkline component
const Sparkline: React.FC<{ data: number[]; positive: boolean }> = ({ data, positive }) => {
  if (!data || data.length === 0) return null

  const width = 60
  const height = 24
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

// Mobile Stock Card Component
const MobileStockCard: React.FC<{
  stock: StockData;
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
  onTrade?: (stock: StockData) => void;
  user?: any;
}> = ({ stock, watchlist, onToggleWatchlist, onTrade, user }) => {
  return (
    <Card className="bg-dark border-cream/10 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold text-cream text-lg">{stock.symbol}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleWatchlist(stock.symbol)}
              className="p-1 h-auto"
            >
              <Star 
                className={`h-4 w-4 ${
                  watchlist.includes(stock.symbol) 
                    ? 'fill-yellow-500 text-yellow-500' 
                    : 'text-cream/60'
                }`} 
              />
            </Button>
          </div>
          <p className="text-sm text-cream/70 line-clamp-1">{stock.name}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-xl text-cream">{formatPrice(stock.price)}</p>
          <div className="flex items-center justify-end space-x-2 mt-1">
            <span className={`text-sm font-medium ${
              stock.change >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {formatChange(stock.change)}
            </span>
            <Badge 
              variant={stock.changePercent >= 0 ? "default" : "destructive"}
              className="text-xs"
            >
              {formatPercent(stock.changePercent)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-cream/70">
        <div className="flex items-center space-x-4">
          <div>
            <span className="text-cream/50">Volume: </span>
            <span>{formatVolume(stock.volume)}</span>
          </div>
          {stock.chart && stock.chart.length > 0 && (
            <Sparkline 
              data={stock.chart} 
              positive={stock.changePercent >= 0} 
            />
          )}
        </div>
        {user && onTrade && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTrade(stock)}
            className="text-xs h-8"
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Trade
          </Button>
        )}
      </div>
    </Card>
  )
}

// Updated Transaction Dialog Component with Currency Support
interface TransactionDialogProps {
  stock: StockData | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: CurrencyTransaction) => void;
  user?: any;
}

const TransactionDialog: React.FC<TransactionDialogProps> = ({ stock, isOpen, onClose, onSubmit, user }) => {
  const [amount, setAmount] = useState<number>(0)
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy')
  const [inputMode, setInputMode] = useState<'currency' | 'shares'>('currency')
  const [maxSellInfo, setMaxSellInfo] = useState<{ shares: number; value: number; price: number } | null>(null)
  const [loading, setLoading] = useState(false)

  // Quick amount buttons - different for currency vs shares
  const quickAmounts = inputMode === 'currency' ? [1, 10, 100, 500, 1000] : [1, 5, 10, 50, 100]

  useEffect(() => {
    if (stock && user && transactionType === 'sell') {
      loadMaxSellInfo()
    } else {
      setMaxSellInfo(null)
    }
  }, [stock, user, transactionType])

  const loadMaxSellInfo = async () => {
    if (!stock || !user) return
    
    try {
      setLoading(true)
      const maxInfo = await StockAPI.getMaxSellAmount(user.uid, stock.symbol)
      setMaxSellInfo(maxInfo)
    } catch (error) {
      console.error('Error loading max sell info:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = () => {
    if (!stock || amount <= 0) return
    
    // Calculate the final USD amount based on input mode
    const finalAmount = inputMode === 'currency' ? amount : amount * stock.price
    
    // Validate sell amount
    if (transactionType === 'sell' && maxSellInfo) {
      if (finalAmount > maxSellInfo.value) {
        toast({
          title: "Invalid Amount",
          description: `You can only sell up to ${formatPrice(maxSellInfo.value)} worth of ${stock.symbol} (${maxSellInfo.shares} shares)`,
          variant: "destructive",
        })
        return
      }
    }
    
    onSubmit({
      userId: user.uid,
      symbol: stock.symbol,
      amount: finalAmount,
      price: stock.price,
      type: transactionType
    })
    
    setAmount(0)
    onClose()
  }

  const calculateShares = () => {
    if (!stock || amount <= 0) return 0
    if (inputMode === 'shares') return amount
    return Math.floor(amount / stock.price * 100) / 100
  }

  const calculateCurrencyAmount = () => {
    if (!stock || amount <= 0) return 0
    if (inputMode === 'currency') return amount
    return amount * stock.price
  }

  const setQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount)
  }

  const setMaxAmount = () => {
    if (maxSellInfo) {
      if (inputMode === 'currency') {
        setAmount(maxSellInfo.value)
      } else {
        setAmount(maxSellInfo.shares)
      }
    }
  }

  if (!stock) return null

  const shares = calculateShares()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark border-cream/10 text-cream max-w-sm mx-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-cream flex items-center space-x-2">
            <span>{transactionType === 'buy' ? 'Buy' : 'Sell'} {stock.symbol}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-cream/5 rounded-lg">
            <div>
              <p className="font-medium text-cream">{stock.symbol}</p>
              <p className="text-sm text-cream/70 line-clamp-1">{stock.name}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-cream">{formatPrice(stock.price)}</p>
              <p className={`text-sm ${stock.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercent(stock.changePercent)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={transactionType === 'buy' ? 'default' : 'outline'}
              onClick={() => setTransactionType('buy')}
              className="flex items-center justify-center"
            >
              <Plus className="h-4 w-4 mr-1" />
              Buy
            </Button>
            <Button
              variant={transactionType === 'sell' ? 'default' : 'outline'}
              onClick={() => setTransactionType('sell')}
              className="flex items-center justify-center"
            >
              <Minus className="h-4 w-4 mr-1" />
              Sell
            </Button>
          </div>

          {/* Input Mode Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={inputMode === 'currency' ? 'default' : 'outline'}
              onClick={() => {
                setInputMode('currency')
                setAmount(0)
              }}
              className="flex items-center justify-center text-sm"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              USD Amount
            </Button>
            <Button
              variant={inputMode === 'shares' ? 'default' : 'outline'}
              onClick={() => {
                setInputMode('shares')
                setAmount(0)
              }}
              className="flex items-center justify-center text-sm"
            >
              <Activity className="h-4 w-4 mr-1" />
              Shares
            </Button>
          </div>

          {/* Show max sell info for sell transactions */}
          {transactionType === 'sell' && maxSellInfo && (
            <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-cream/70">Available to sell:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={setMaxAmount}
                  className="text-xs h-6 px-2"
                >
                  Use Max
                </Button>
              </div>
              <p className="text-sm text-cream">
                {maxSellInfo.shares} shares • {formatPrice(maxSellInfo.value)}
              </p>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <Label htmlFor="amount" className="text-cream/80">
              {inputMode === 'currency' ? 'Amount (USD)' : 'Number of Shares'}
            </Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step={inputMode === 'currency' ? '0.01' : '1'}
              value={amount || ''}
              onChange={(e) => {
                const value = e.target.value
                if (value === '' || value === '0') {
                  setAmount(0)
                } else {
                  const parsedValue = parseFloat(value)
                  setAmount(isNaN(parsedValue) ? 0 : Math.max(0, parsedValue))
                }
              }}
              className="bg-cream/5 border-cream/10 text-cream mt-1"
              placeholder={inputMode === 'currency' ? 'Enter amount in USD' : 'Enter number of shares'}
            />
            {amount > 0 && (
              <p className="text-xs text-cream/60 mt-1">
                {inputMode === 'currency' 
                  ? `≈ ${calculateShares()} shares`
                  : `≈ ${formatPrice(calculateCurrencyAmount())}`
                }
              </p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <Label className="text-cream/80 text-xs">
              Quick {inputMode === 'currency' ? 'amounts' : 'quantities'}:
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAmount(quickAmount)}
                  className="text-xs h-8 px-3"
                >
                  {inputMode === 'currency' ? `$${quickAmount}` : `${quickAmount}`}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-3 bg-cream/5 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-cream/70">Transaction Amount:</span>
              <span className="font-semibold text-cream">{formatPrice(calculateCurrencyAmount())}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cream/70">{inputMode === 'currency' ? 'Estimated Shares:' : 'Shares:'}</span>
              <span className="font-semibold text-cream">{calculateShares()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cream/70">Price per Share:</span>
              <span className="font-semibold text-cream">{formatPrice(stock.price)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={amount <= 0 || loading}>
              {loading ? <LoadingSpinner size="sm" /> : `${transactionType === 'buy' ? 'Buy' : 'Sell'} ${formatPrice(calculateCurrencyAmount())}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type SortField = 'symbol' | 'price' | 'change' | 'changePercent' | 'volume' | 'marketCap'
type SortDirection = 'asc' | 'desc'
type TabType = 'trending-now' | 'search-results' | 'watchlist' | 'most-active' | 'top-gainers' | 'top-losers'

export default function StocksPage() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [trendingStocks, setTrendingStocks] = useState<StockData[]>([])
  const [searchResults, setSearchResults] = useState<StockData[]>([])
  const [filteredStocks, setFilteredStocks] = useState<StockData[]>([])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>('changePercent')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [activeTab, setActiveTab] = useState<TabType>('trending-now')
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [portfolioRefreshKey, setPortfolioRefreshKey] = useState(0)

  // Real-time price updates
  const allSymbols = React.useMemo(() => {
    const symbols = new Set<string>()
    trendingStocks.forEach(stock => symbols.add(stock.symbol))
    searchResults.forEach(stock => symbols.add(stock.symbol))
    watchlist.forEach(symbol => symbols.add(symbol))
    return Array.from(symbols)
  }, [trendingStocks, searchResults, watchlist])

  const { prices: realTimePrices, connected: priceConnected } = useStockPrices({
    symbols: allSymbols,
    enabled: allSymbols.length > 0,
  })

  // Debounced search
  const debounceTimer = React.useRef<NodeJS.Timeout>()

  useEffect(() => {
    loadStockData()
    loadWatchlist()
  }, [])

  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Set new timer for search
    if (searchQuery.trim().length >= 2) {
      debounceTimer.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 300)
    } else {
      setSearchResults([])
      if (activeTab === 'search-results') {
        setActiveTab('trending-now')
      }
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchQuery])

  useEffect(() => {
    filterAndSortStocks()
  }, [trendingStocks, searchResults, activeTab, sortField, sortDirection, watchlist])

  const loadStockData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const stocks = await StockAPI.getTrendingStocks()
      setTrendingStocks(stocks)
    } catch (err) {
      console.error('Error loading stock data:', err)
      setError('Failed to load stock data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadWatchlist = async () => {
    if (!user) {
      // For anonymous users, use localStorage
      const saved = localStorage.getItem(`watchlist_anonymous`)
      if (saved) {
        setWatchlist(JSON.parse(saved))
      }
      return
    }

    try {
      // For authenticated users, load from Firestore
      const firestoreWatchlist = await StockAPI.getUserWatchlist(user.uid)
      setWatchlist(firestoreWatchlist)
    } catch (error) {
      console.error('Error loading watchlist from Firestore:', error)
      // Fallback to localStorage
      const saved = localStorage.getItem(`watchlist_${user.uid}`)
      if (saved) {
        setWatchlist(JSON.parse(saved))
      }
    }
  }

  const performSearch = async (query: string) => {
    try {
      setSearchLoading(true)
      const results = await StockAPI.searchStocks(query)
      setSearchResults(results)
      if (results.length > 0) {
        setActiveTab('search-results')
      }
    } catch (err) {
      console.error('Error searching stocks:', err)
      toast({
        title: "Search Error",
        description: "Failed to search stocks. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSearchLoading(false)
    }
  }

  const toggleWatchlist = async (symbol: string) => {
    const isRemoving = watchlist.includes(symbol)
    const newWatchlist = isRemoving
      ? watchlist.filter(s => s !== symbol)
      : [...watchlist, symbol]
    
    setWatchlist(newWatchlist)
    
    try {
      if (user) {
        // Save to Firestore for authenticated users
        if (isRemoving) {
          await StockAPI.removeFromWatchlist(user.uid, symbol)
        } else {
          await StockAPI.addToWatchlist(user.uid, symbol)
        }
      } else {
        // Save to localStorage for anonymous users
        localStorage.setItem(`watchlist_anonymous`, JSON.stringify(newWatchlist))
      }
      
      toast({
        title: isRemoving ? "Removed from Watchlist" : "Added to Watchlist",
        description: `${symbol} ${isRemoving ? 'removed from' : 'added to'} your watchlist`,
      })
    } catch (error) {
      console.error('Error updating watchlist:', error)
      // Revert the optimistic update
      setWatchlist(watchlist)
      
      toast({
        title: "Error",
        description: "Failed to update watchlist. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Function to merge real-time prices with stock data
  const updateStockWithRealTimePrice = (stock: StockData): StockData => {
    const realTimePrice = realTimePrices[stock.symbol]
    if (realTimePrice) {
      return {
        ...stock,
        price: realTimePrice.price,
        change: realTimePrice.change,
        changePercent: realTimePrice.changePercent,
      }
    }
    return stock
  }

  const handleTransaction = async (transaction: CurrencyTransaction) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to execute stock transactions.",
        variant: "destructive",
      })
      return
    }

    try {
      // Execute the currency-based transaction
      await StockAPI.executeCurrencyTransaction(transaction)
      
      toast({
        title: `${transaction.type === 'buy' ? 'Buy' : 'Sell'} Order Executed`,
        description: `Successfully ${transaction.type === 'buy' ? 'bought' : 'sold'} ${formatPrice(transaction.amount)} worth of ${transaction.symbol}`,
      })
      
      // Refresh stock data and portfolio to reflect changes
      await loadStockData()
      setPortfolioRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Transaction failed:', error)
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to execute transaction. Please try again.",
        variant: "destructive",
      })
    }
  }

  const filterAndSortStocks = () => {
    let stocks: StockData[] = []
    
    switch (activeTab) {
      case 'trending-now':
        stocks = trendingStocks.map(updateStockWithRealTimePrice)
        break
      case 'search-results':
        stocks = searchResults.map(updateStockWithRealTimePrice)
        break
      case 'watchlist':
        stocks = trendingStocks.filter(stock => watchlist.includes(stock.symbol)).map(updateStockWithRealTimePrice)
        break
      case 'most-active':
        stocks = [...trendingStocks].map(updateStockWithRealTimePrice).sort((a, b) => b.volume - a.volume)
        break
      case 'top-gainers':
        stocks = [...trendingStocks].map(updateStockWithRealTimePrice).sort((a, b) => b.changePercent - a.changePercent).slice(0, 10)
        break
      case 'top-losers':
        stocks = [...trendingStocks].map(updateStockWithRealTimePrice).sort((a, b) => a.changePercent - b.changePercent).slice(0, 10)
        break
      default:
        stocks = trendingStocks.map(updateStockWithRealTimePrice)
    }

    // Apply sorting
    const sortedStocks = [...stocks].sort((a, b) => {
      let aValue: number | string = 0
      let bValue: number | string = 0

      switch (sortField) {
        case 'symbol':
          aValue = a.symbol
          bValue = b.symbol
          break
        case 'price':
          aValue = a.price
          bValue = b.price
          break
        case 'change':
          aValue = a.change
          bValue = b.change
          break
        case 'changePercent':
          aValue = a.changePercent
          bValue = b.changePercent
          break
        case 'volume':
          aValue = a.volume
          bValue = b.volume
          break
        case 'marketCap':
          // Handle market cap parsing
          const parseMarketCap = (cap: string) => {
            if (typeof cap === 'number') return cap
            if (cap === 'N/A' || !cap) return 0
            const num = parseFloat(cap.toString().replace(/[^0-9.-]+/g, ''))
            return isNaN(num) ? 0 : num
          }
          aValue = parseMarketCap(a.marketCap)
          bValue = parseMarketCap(b.marketCap)
          break
        default:
          aValue = a.changePercent
          bValue = b.changePercent
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

    setFilteredStocks(sortedStocks)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-40" />
    return sortDirection === 'asc' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />
  }

  const openTransactionDialog = (stock: StockData) => {
    setSelectedStock(stock)
    setTransactionDialogOpen(true)
  }

  const handlePortfolioRefresh = () => {
    setPortfolioRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-dark text-cream">
        <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex-1 p-4 sm:p-6">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-dark text-cream">
        <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex-1 p-4 sm:p-6">
          <div className="text-center text-cream/60 space-y-4">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{error}</p>
            <Button onClick={loadStockData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-outfit text-cream">Stocks</h1>
              <p className="text-cream/60 mt-1 text-sm sm:text-base">Search and track stock market performance</p>
            </div>
            <div className="flex items-center space-x-2">
              {priceConnected && (
                <div className="flex items-center space-x-1 text-green-500 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="hidden sm:inline">Live</span>
                </div>
              )}
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => StockAPI.clearCache()}>
                  <span className="hidden sm:inline">Refresh Data</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>
                {!priceConnected && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      StockAPI.resetConnectionState()
                      window.location.reload()
                    }}
                    className="text-orange-400 hover:text-orange-300"
                  >
                    <span className="hidden sm:inline">Reconnect</span>
                    <span className="sm:hidden">Reconnect</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Layout: Side by Side */}
          <div className="hidden xl:flex xl:space-x-8">
            {/* Left Column - Stocks Section */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Search Section */}
              <Card className="bg-dark border-cream/10">
                <CardContent className="p-3 sm:p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cream/60" />
                    <Input
                      placeholder="Search stocks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-cream/5 border-cream/10 text-cream placeholder:text-cream/60"
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <LoadingSpinner size="sm" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="w-full overflow-x-auto">
                <div className="flex space-x-1 bg-cream/5 p-1 rounded-lg min-w-max">
                  {[
                    { key: 'trending-now', label: 'Trending', fullLabel: 'Trending Now' },
                    { key: 'search-results', label: 'Search', fullLabel: 'Search Results', disabled: searchResults.length === 0 },
                    { key: 'watchlist', label: 'Watchlist', fullLabel: 'Watchlist' },
                    { key: 'most-active', label: 'Active', fullLabel: 'Most Active' },
                    { key: 'top-gainers', label: 'Gainers', fullLabel: 'Top Gainers' },
                    { key: 'top-losers', label: 'Losers', fullLabel: 'Top Losers' },
                  ].map((tab) => (
                    <Button
                      key={tab.key}
                      variant={activeTab === tab.key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab(tab.key as TabType)}
                      disabled={tab.disabled}
                      className="whitespace-nowrap px-3 sm:px-4"
                    >
                      <span className="sm:hidden">{tab.label}</span>
                      <span className="hidden sm:inline">{tab.fullLabel}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Desktop Table View */}
              <Card className="bg-dark border-cream/10">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow className="border-cream/10 hover:bg-cream/5">
                          <TableHead className="text-cream/80 w-16">Actions</TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream w-20"
                            onClick={() => handleSort('symbol')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Symbol</span>
                              {getSortIcon('symbol')}
                            </div>
                          </TableHead>
                          <TableHead className="text-cream/80 min-w-40">Name</TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-24"
                            onClick={() => handleSort('price')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Price</span>
                              {getSortIcon('price')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-20"
                            onClick={() => handleSort('change')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Change</span>
                              {getSortIcon('change')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-24"
                            onClick={() => handleSort('changePercent')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Change %</span>
                              {getSortIcon('changePercent')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-20"
                            onClick={() => handleSort('volume')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Volume</span>
                              {getSortIcon('volume')}
                            </div>
                          </TableHead>
                          <TableHead className="text-cream/80 text-right w-20">Chart</TableHead>
                          {user && <TableHead className="text-cream/80 w-20">Trade</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStocks.map((stock) => (
                          <TableRow 
                            key={stock.symbol} 
                            className="border-cream/10 hover:bg-cream/5"
                          >
                            <TableCell className="w-16">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleWatchlist(stock.symbol)}
                                className="p-1 h-8 w-8"
                              >
                                <Star 
                                  className={`h-4 w-4 ${
                                    watchlist.includes(stock.symbol) 
                                      ? 'fill-yellow-500 text-yellow-500' 
                                      : 'text-cream/60 hover:text-cream'
                                  }`} 
                                />
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium text-cream w-20">
                              {stock.symbol}
                            </TableCell>
                            <TableCell className="text-cream/70 min-w-40">
                              <div className="truncate">{stock.name}</div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-cream w-24">
                              {formatPrice(stock.price)}
                            </TableCell>
                            <TableCell className={`text-right font-medium w-20 ${
                              stock.change >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {formatChange(stock.change)}
                            </TableCell>
                            <TableCell className="text-right w-24">
                              <Badge 
                                variant={stock.changePercent >= 0 ? "default" : "destructive"}
                                className="font-medium"
                              >
                                {formatPercent(stock.changePercent)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-cream/70 w-20">
                              <div className="text-xs">{formatVolume(stock.volume)}</div>
                            </TableCell>
                            <TableCell className="text-right w-20">
                              {stock.chart && stock.chart.length > 0 && (
                                <Sparkline 
                                  data={stock.chart} 
                                  positive={stock.changePercent >= 0} 
                                />
                              )}
                            </TableCell>
                            {user && (
                              <TableCell className="w-20">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openTransactionDialog(stock)}
                                  className="text-xs h-8"
                                >
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Trade
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {filteredStocks.length === 0 && (
                    <div className="text-center py-8 text-cream/60">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No stocks found for this criteria</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Transaction Dialog */}
              <TransactionDialog
                stock={selectedStock}
                isOpen={transactionDialogOpen}
                onClose={() => setTransactionDialogOpen(false)}
                onSubmit={handleTransaction}
                user={user}
              />
            </div>

            {/* Right Column - Portfolio Section */}
            <div className="w-96 flex-shrink-0">
              <UserPortfolio 
                key={portfolioRefreshKey} 
                onRefresh={handlePortfolioRefresh}
              />
            </div>
          </div>

          {/* Mobile/Tablet Layout: Stacked */}
          <div className="xl:hidden">
            {/* Stocks Section */}
            <div className="space-y-4 sm:space-y-6">
              {/* Search Section */}
              <Card className="bg-dark border-cream/10">
                <CardContent className="p-3 sm:p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cream/60" />
                    <Input
                      placeholder="Search stocks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-cream/5 border-cream/10 text-cream placeholder:text-cream/60"
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <LoadingSpinner size="sm" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tabs - Responsive horizontal scroll */}
              <div className="w-full overflow-x-auto">
                <div className="flex space-x-1 bg-cream/5 p-1 rounded-lg min-w-max">
                  {[
                    { key: 'trending-now', label: 'Trending', fullLabel: 'Trending Now' },
                    { key: 'search-results', label: 'Search', fullLabel: 'Search Results', disabled: searchResults.length === 0 },
                    { key: 'watchlist', label: 'Watchlist', fullLabel: 'Watchlist' },
                    { key: 'most-active', label: 'Active', fullLabel: 'Most Active' },
                    { key: 'top-gainers', label: 'Gainers', fullLabel: 'Top Gainers' },
                    { key: 'top-losers', label: 'Losers', fullLabel: 'Top Losers' },
                  ].map((tab) => (
                    <Button
                      key={tab.key}
                      variant={activeTab === tab.key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setActiveTab(tab.key as TabType)}
                      disabled={tab.disabled}
                      className="whitespace-nowrap px-3 sm:px-4"
                    >
                      <span className="sm:hidden">{tab.label}</span>
                      <span className="hidden sm:inline">{tab.fullLabel}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Desktop Table View (for large but not xl screens) */}
              <div className="hidden lg:xl:hidden lg:block">
                <Card className="bg-dark border-cream/10">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[900px]">
                        <TableHeader>
                          <TableRow className="border-cream/10 hover:bg-cream/5">
                            <TableHead className="text-cream/80 w-16">Actions</TableHead>
                            <TableHead 
                              className="text-cream/80 cursor-pointer hover:text-cream w-20"
                              onClick={() => handleSort('symbol')}
                            >
                              <div className="flex items-center space-x-1">
                                <span>Symbol</span>
                                {getSortIcon('symbol')}
                              </div>
                            </TableHead>
                            <TableHead className="text-cream/80 min-w-40">Name</TableHead>
                            <TableHead 
                              className="text-cream/80 cursor-pointer hover:text-cream text-right w-24"
                              onClick={() => handleSort('price')}
                            >
                              <div className="flex items-center justify-end space-x-1">
                                <span>Price</span>
                                {getSortIcon('price')}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-cream/80 cursor-pointer hover:text-cream text-right w-20"
                              onClick={() => handleSort('change')}
                            >
                              <div className="flex items-center justify-end space-x-1">
                                <span>Change</span>
                                {getSortIcon('change')}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-cream/80 cursor-pointer hover:text-cream text-right w-24"
                              onClick={() => handleSort('changePercent')}
                            >
                              <div className="flex items-center justify-end space-x-1">
                                <span>Change %</span>
                                {getSortIcon('changePercent')}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="text-cream/80 cursor-pointer hover:text-cream text-right w-20"
                              onClick={() => handleSort('volume')}
                            >
                              <div className="flex items-center justify-end space-x-1">
                                <span>Volume</span>
                                {getSortIcon('volume')}
                              </div>
                            </TableHead>
                            <TableHead className="text-cream/80 text-right w-20">Chart</TableHead>
                            {user && <TableHead className="text-cream/80 w-20">Trade</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStocks.map((stock) => (
                            <TableRow 
                              key={stock.symbol} 
                              className="border-cream/10 hover:bg-cream/5"
                            >
                              <TableCell className="w-16">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleWatchlist(stock.symbol)}
                                  className="p-1 h-8 w-8"
                                >
                                  <Star 
                                    className={`h-4 w-4 ${
                                      watchlist.includes(stock.symbol) 
                                        ? 'fill-yellow-500 text-yellow-500' 
                                        : 'text-cream/60 hover:text-cream'
                                    }`} 
                                  />
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium text-cream w-20">
                                {stock.symbol}
                              </TableCell>
                              <TableCell className="text-cream/70 min-w-40">
                                <div className="truncate">{stock.name}</div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-cream w-24">
                                {formatPrice(stock.price)}
                              </TableCell>
                              <TableCell className={`text-right font-medium w-20 ${
                                stock.change >= 0 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {formatChange(stock.change)}
                              </TableCell>
                              <TableCell className="text-right w-24">
                                <Badge 
                                  variant={stock.changePercent >= 0 ? "default" : "destructive"}
                                  className="font-medium"
                                >
                                  {formatPercent(stock.changePercent)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-cream/70 w-20">
                                <div className="text-xs">{formatVolume(stock.volume)}</div>
                              </TableCell>
                              <TableCell className="text-right w-20">
                                {stock.chart && stock.chart.length > 0 && (
                                  <Sparkline 
                                    data={stock.chart} 
                                    positive={stock.changePercent >= 0} 
                                  />
                                )}
                              </TableCell>
                              {user && (
                                <TableCell className="w-20">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openTransactionDialog(stock)}
                                    className="text-xs h-8"
                                  >
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Trade
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {filteredStocks.length === 0 && (
                      <div className="text-center py-8 text-cream/60">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No stocks found for this criteria</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden space-y-3">
                {filteredStocks.length === 0 ? (
                  <div className="text-center py-8 text-cream/60">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No stocks found for this criteria</p>
                  </div>
                ) : (
                  filteredStocks.map((stock) => (
                    <MobileStockCard
                      key={stock.symbol}
                      stock={stock}
                      watchlist={watchlist}
                      onToggleWatchlist={toggleWatchlist}
                      onTrade={user ? openTransactionDialog : undefined}
                      user={user}
                    />
                  ))
                )}
              </div>

              {/* Transaction Dialog */}
              <TransactionDialog
                stock={selectedStock}
                isOpen={transactionDialogOpen}
                onClose={() => setTransactionDialogOpen(false)}
                onSubmit={handleTransaction}
                user={user}
              />
            </div>

            {/* Portfolio Section for Mobile/Tablet */}
            <div className="mt-8 pt-8 border-t border-cream/10">
              <UserPortfolio 
                key={portfolioRefreshKey} 
                onRefresh={handlePortfolioRefresh}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 