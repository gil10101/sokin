"use client"



import React, { useState, useEffect, useCallback, useRef } from "react"
import { ChevronRight, Search, TrendingUp, TrendingDown, Activity, ArrowUpDown, Plus, Minus, Star, DollarSign } from "lucide-react"
import { UserPortfolio } from "@/components/dashboard/user-portfolio"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { useStockPrices } from "@/hooks/use-stock-prices"
import { TransactionDialog } from "@/components/dashboard/stock-transaction-dialog"
import { User } from "@/lib/types"
import { 
  StockAPI, 
  StockData,
  CurrencyTransaction,
  formatPrice, 
  formatChange, 
  formatPercent,
  formatVolume
} from "@/lib/stock-api"
import { EmptyState } from "@/components/dashboard/empty-state"

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
  onTrade?: (stock: StockData, action?: 'trade' | 'add') => void;
  user?: User | null;
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
              stock.change > 0 ? 'text-green-500' : 
              stock.change < 0 ? 'text-red-500' : 
              'text-cream/60'
            }`}>
              {formatChange(stock.change)}
            </span>
            <Badge 
              variant={
                stock.changePercent > 0 ? "default" : 
                stock.changePercent < 0 ? "destructive" : 
                "secondary"
              }
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
              positive={stock.changePercent > 0} 
            />
          )}
        </div>
        {user && onTrade && (
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTrade(stock, 'add')}
              className="text-xs h-8 px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTrade(stock, 'trade')}
              className="text-xs h-8 px-2"
            >
              <DollarSign className="h-3 w-3 mr-1" />
              Trade
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}


type SortField = 'symbol' | 'price' | 'change' | 'changePercent' | 'volume' | 'weekHigh52' | 'weekLow52'
type SortDirection = 'asc' | 'desc'
type TabType = 'trending-now' | 'search-results' | 'watchlist' | 'most-active' | 'top-gainers' | 'top-losers'

interface StocksPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function StocksPage(props: StocksPageProps) {
  const { user } = useAuth()
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])
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
  const [transactionDialogMode, setTransactionDialogMode] = useState<'trade' | 'add'>('trade')
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
  const debounceTimer = React.useRef<NodeJS.Timeout | null>(null)

  const loadStockData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const stocks = await StockAPI.getTrendingStocks()
      setTrendingStocks(stocks)
    } catch (err) {

      setError('Failed to load stock data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadWatchlist = useCallback(async () => {
    if (!userRef.current) {
      // For anonymous users, use localStorage
      const saved = localStorage.getItem(`watchlist_anonymous`)
      if (saved) {
        setWatchlist(JSON.parse(saved))
      }
      return
    }

    try {
      // For authenticated users, load from Firestore
      const firestoreWatchlist = await StockAPI.getUserWatchlist(userRef.current.uid)
      setWatchlist(firestoreWatchlist)
    } catch (err) {
      logger.error("Error loading watchlist", {
        userId: user?.uid,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }, [])

  useEffect(() => {
    loadStockData()
    loadWatchlist()
  }, [user])

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

  // Function to merge real-time prices with stock data
  const updateStockWithRealTimePrice = useCallback((stock: StockData): StockData => {
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
  }, [realTimePrices])

  const filterAndSortStocks = useCallback(() => {
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
          aValue = a.changePercent
          bValue = b.changePercent
          break
        case 'volume':
          aValue = a.volume
          bValue = b.volume
          break
        case 'weekHigh52':
          aValue = a.weekHigh52
          bValue = b.weekHigh52
          break
        case 'weekLow52':
          aValue = a.weekLow52
          bValue = b.weekLow52
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
  }, [activeTab, trendingStocks, searchResults, sortField, sortDirection, watchlist, updateStockWithRealTimePrice])

  useEffect(() => {
    filterAndSortStocks()
  }, [trendingStocks, searchResults, activeTab, sortField, sortDirection, watchlist, updateStockWithRealTimePrice])



  const performSearch = async (query: string) => {
    try {
      setSearchLoading(true)
      const results = await StockAPI.searchStocks(query)
      setSearchResults(results)
      if (results.length > 0) {
        setActiveTab('search-results')
      }
    } catch (err) {

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

      // Revert the optimistic update
      setWatchlist(watchlist)
      
      toast({
        title: "Error",
        description: "Failed to update watchlist. Please try again.",
        variant: "destructive",
      })
    }
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

      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to execute transaction. Please try again.",
        variant: "destructive",
      })
    }
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

  const openTransactionDialog = (stock: StockData, action: 'trade' | 'add' = 'trade') => {
    setSelectedStock(stock)
    setTransactionDialogMode(action)
    setTransactionDialogOpen(true)
  }

  const handlePortfolioRefresh = () => {
    setPortfolioRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-4 sm:p-6">
        <div className="text-center text-cream/60 space-y-4">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{error}</p>
          <Button onClick={loadStockData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-6 xl:p-8 2xl:p-12">
        <div className="w-full">
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
                  <span className="hidden sm:inline">Live Updates</span>
                </div>
              )}
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
                  <div className="w-full">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow className="border-cream/10 hover:bg-cream/5">
                          <TableHead className="text-cream/80 w-[6%]">
                            <Star className="h-4 w-4 mx-auto" />
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream w-[10%]"
                            onClick={() => handleSort('symbol')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Symbol</span>
                              {getSortIcon('symbol')}
                            </div>
                          </TableHead>
                          <TableHead className="text-cream/80 w-[21%]">
                            Company Name
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-[12%]"
                            onClick={() => handleSort('price')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Price</span>
                              {getSortIcon('price')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-[10%]"
                            onClick={() => handleSort('change')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Change</span>
                              {getSortIcon('change')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-[10%]"
                            onClick={() => handleSort('changePercent')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Change %</span>
                              {getSortIcon('changePercent')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-[12%]"
                            onClick={() => handleSort('volume')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>Volume</span>
                              {getSortIcon('volume')}
                            </div>
                          </TableHead>
                          <TableHead 
                            className="text-cream/80 cursor-pointer hover:text-cream text-right w-[14%]"
                            onClick={() => handleSort('weekHigh52')}
                          >
                            <div className="flex items-center justify-end space-x-1">
                              <span>52W High/Low</span>
                              {getSortIcon('weekHigh52')}
                            </div>
                          </TableHead>
                          <TableHead className="text-cream/80 text-center w-[10%]">
                            Chart
                          </TableHead>
                          {user && <TableHead className="text-cream/80 text-center w-[15%]">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStocks.map((stock) => (
                          <TableRow 
                            key={stock.symbol} 
                            className="border-cream/10 hover:bg-cream/5"
                          >
                            <TableCell className="text-center">
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
                            <TableCell className="font-bold text-cream">
                              {stock.symbol}
                            </TableCell>
                            <TableCell className="text-cream/90">
                              <div className="truncate" title={stock.name}>
                                {stock.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-cream">
                              {formatPrice(stock.price)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              stock.change > 0 ? 'text-green-500' : 
                              stock.change < 0 ? 'text-red-500' : 
                              'text-cream/60'
                            }`}>
                              {formatChange(stock.change)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge 
                                variant={
                                  stock.changePercent > 0 ? "default" : 
                                  stock.changePercent < 0 ? "destructive" : 
                                  "secondary"
                                }
                                className="font-medium"
                              >
                                {formatPercent(stock.changePercent)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-cream/70">
                              <div className="text-sm">{formatVolume(stock.volume)}</div>
                            </TableCell>
                            <TableCell className="text-right text-cream/70">
                              <div className="text-xs space-y-1">
                                <div className="text-green-500">
                                  {formatPrice(stock.weekHigh52)}
                                </div>
                                <div className="text-red-500">
                                  {formatPrice(stock.weekLow52)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {stock.chart && stock.chart.length > 0 && (
                                <Sparkline 
                                  data={stock.chart} 
                                  positive={stock.changePercent > 0} 
                                />
                              )}
                            </TableCell>
                            {user && (
                              <TableCell className="text-center">
                                <div className="flex space-x-1 justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openTransactionDialog(stock, 'add')}
                                    className="text-xs h-8 px-2"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openTransactionDialog(stock, 'trade')}
                                    className="text-xs h-8 px-2"
                                  >
                                    Trade
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {filteredStocks.length === 0 && (
                    <EmptyState
                      size="sm"
                      icon={Activity}
                      title="No stocks found for this criteria"
                    />
                  )}
                </CardContent>
              </Card>

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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
                                stock.change > 0 ? 'text-green-500' : 
                                stock.change < 0 ? 'text-red-500' : 
                                'text-cream/60'
                              }`}>
                                {formatChange(stock.change)}
                              </TableCell>
                              <TableCell className="text-right w-24">
                                <Badge 
                                  variant={
                                    stock.changePercent > 0 ? "default" : 
                                    stock.changePercent < 0 ? "destructive" : 
                                    "secondary"
                                  }
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
                                    positive={stock.changePercent > 0} 
                                  />
                                )}
                              </TableCell>
                              {user && (
                                <TableCell className="w-32">
                                  <div className="flex space-x-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openTransactionDialog(stock, 'add')}
                                      className="text-xs h-8 px-2"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openTransactionDialog(stock, 'trade')}
                                      className="text-xs h-8 px-2"
                                    >
                                      <DollarSign className="h-3 w-3 mr-1" />
                                      Trade
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {filteredStocks.length === 0 && (
                      <EmptyState
                        size="sm"
                        icon={Activity}
                        title="No stocks found for this criteria"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden space-y-3">
                {filteredStocks.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={Activity}
                    title="No stocks found for this criteria"
                  />
                ) : (
                  filteredStocks.map((stock) => (
                    <MobileStockCard
                      key={stock.symbol}
                      stock={stock}
                      watchlist={watchlist}
                      onToggleWatchlist={toggleWatchlist}
                      onTrade={user ? openTransactionDialog : undefined}
                      user={user as User | null | undefined}
                    />
                  ))
                )}
              </div>

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
      {/* One dialog for the whole page. These used to be rendered inside each
          responsive branch, and because those branches are CSS-hidden rather
          than conditionally rendered, every open produced two stacked dialogs.
          Mounting only while open also guarantees each transaction starts from
          clean state instead of inheriting the previous one's. */}
      {transactionDialogOpen && (
        <TransactionDialog
          stock={selectedStock}
          isOpen={transactionDialogOpen}
          onClose={() => setTransactionDialogOpen(false)}
          onSubmit={handleTransaction}
          user={user as User | null | undefined}
          mode={transactionDialogMode}
        />
      )}
    </>
  )
} 