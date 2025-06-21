"use client"

import React, { useState, useEffect } from "react"
import { ChevronRight, Search, TrendingUp, TrendingDown, Activity, ArrowUpDown } from "lucide-react"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Badge } from "../../../components/ui/badge"
import { Input } from "../../../components/ui/input"
import { LoadingSpinner } from "../../../components/ui/loading-spinner"
import { Button } from "../../../components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { useAuth } from "../../../contexts/auth-context"
import { 
  StockAPI, 
  StockData,
  formatPrice, 
  formatChange, 
  formatPercent,
  formatVolume
} from "../../../lib/stock-api"

// Simple sparkline component
const Sparkline: React.FC<{ data: number[]; positive: boolean }> = ({ data, positive }) => {
  if (!data || data.length === 0) return null

  const width = 80
  const height = 30
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
        strokeWidth="2"
        points={points}
      />
    </svg>
  )
}

type SortField = 'symbol' | 'price' | 'change' | 'changePercent' | 'volume' | 'marketCap'
type SortDirection = 'asc' | 'desc'

export default function StocksPage() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [trendingStocks, setTrendingStocks] = useState<StockData[]>([])
  const [filteredStocks, setFilteredStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>('changePercent')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [activeTab, setActiveTab] = useState<'most-active' | 'trending-now' | 'top-gainers' | 'top-losers'>('trending-now')

  useEffect(() => {
    loadStockData()
  }, [])

  useEffect(() => {
    filterAndSortStocks()
  }, [trendingStocks, searchQuery, sortField, sortDirection, activeTab])

  const loadStockData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const stocks = await StockAPI.getTrendingStocks()
      setTrendingStocks(stocks)
    } catch (err) {
      console.error('Error loading stock data:', err)
      setError('Failed to load stock market data')
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortStocks = () => {
    let filtered = [...trendingStocks]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(stock => 
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply tab filter
    switch (activeTab) {
      case 'top-gainers':
        filtered = filtered.filter(stock => stock.changePercent > 0)
        break
      case 'top-losers':
        filtered = filtered.filter(stock => stock.changePercent < 0)
        break
      case 'most-active':
        filtered = filtered.sort((a, b) => b.volume - a.volume)
        break
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number | string = a[sortField]
      let bValue: number | string = b[sortField]

      if (sortField === 'marketCap') {
        // Convert market cap strings to numbers for sorting
        const parseMarketCap = (cap: string) => {
          const num = parseFloat(cap)
          if (cap.includes('T')) return num * 1000000000000
          if (cap.includes('B')) return num * 1000000000
          if (cap.includes('M')) return num * 1000000
          return num
        }
        aValue = parseMarketCap(a.marketCap)
        bValue = parseMarketCap(b.marketCap)
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue)
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })

    setFilteredStocks(filtered)
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
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 opacity-50" />
    return <ArrowUpDown className={`h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-dark text-cream overflow-hidden">
        <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl md:text-3xl font-bold font-outfit text-cream">Stocks</h1>
              <ChevronRight className="h-5 w-5 text-cream/60" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cream/60" />
              <Input
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-cream/5 border-cream/10 text-cream placeholder:text-cream/60 w-64"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-cream/5 p-1 rounded-lg w-fit">
            {[
              { id: 'trending-now', label: 'Trending Now' },
              { id: 'most-active', label: 'Most Active' },
              { id: 'top-gainers', label: 'Top Gainers' },
              { id: 'top-losers', label: 'Top Losers' },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id as any)}
                className={`text-sm ${
                  activeTab === tab.id 
                    ? 'bg-cream text-dark' 
                    : 'text-cream/70 hover:text-cream hover:bg-cream/10'
                }`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Trending Stocks Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredStocks.slice(0, 8).map((stock) => (
              <Card key={stock.symbol} className="bg-cream/5 border-cream/10 hover:bg-cream/10 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-cream text-lg">{stock.symbol}</p>
                      <p className="text-xs text-cream/60 truncate max-w-24">{stock.name}</p>
                    </div>
                    {stock.changePercent >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-cream">{formatPrice(stock.price)}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`text-sm font-medium ${
                          stock.change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatChange(stock.change)}
                        </span>
                        <br />
                        <Badge 
                          variant={stock.changePercent >= 0 ? "default" : "destructive"} 
                          className="text-xs mt-1"
                        >
                          {formatPercent(stock.changePercent)}
                        </Badge>
                      </div>
                      {stock.chart && (
                        <Sparkline 
                          data={stock.chart} 
                          positive={stock.changePercent >= 0} 
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detailed Table */}
          <Card className="bg-cream/5 border-cream/10">
            <CardHeader>
              <CardTitle className="text-lg font-outfit text-cream">Detailed Market Data</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-cream/10 hover:bg-cream/5">
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream"
                        onClick={() => handleSort('symbol')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Symbol</span>
                          {getSortIcon('symbol')}
                        </div>
                      </TableHead>
                      <TableHead className="text-cream/80">Name</TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('price')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Price</span>
                          {getSortIcon('price')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('change')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Change</span>
                          {getSortIcon('change')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('changePercent')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Change %</span>
                          {getSortIcon('changePercent')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('volume')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Volume</span>
                          {getSortIcon('volume')}
                        </div>
                      </TableHead>
                      <TableHead className="text-cream/80 text-right">Avg Vol (3M)</TableHead>
                      <TableHead 
                        className="text-cream/80 cursor-pointer hover:text-cream text-right"
                        onClick={() => handleSort('marketCap')}
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Market Cap</span>
                          {getSortIcon('marketCap')}
                        </div>
                      </TableHead>
                      <TableHead className="text-cream/80 text-right">P/E Ratio (TTM)</TableHead>
                      <TableHead className="text-cream/80 text-right">52 Wk Change %</TableHead>
                      <TableHead className="text-cream/80 text-right">52 Wk High</TableHead>
                      <TableHead className="text-cream/80 text-right">Chart</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStocks.map((stock) => (
                      <TableRow key={stock.symbol} className="border-cream/10 hover:bg-cream/5">
                        <TableCell className="font-medium text-cream">{stock.symbol}</TableCell>
                        <TableCell className="text-cream/80 max-w-48 truncate">{stock.name}</TableCell>
                        <TableCell className="text-right font-medium text-cream">{formatPrice(stock.price)}</TableCell>
                        <TableCell className={`text-right font-medium ${
                          stock.change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatChange(stock.change)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          stock.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatPercent(stock.changePercent)}
                        </TableCell>
                        <TableCell className="text-right text-cream/80">{formatVolume(stock.volume)}</TableCell>
                        <TableCell className="text-right text-cream/80">{formatVolume(stock.avgVolume)}</TableCell>
                        <TableCell className="text-right text-cream/80">{stock.marketCap}</TableCell>
                        <TableCell className="text-right text-cream/80">
                          {stock.peRatio ? stock.peRatio.toFixed(2) : '--'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${
                          stock.weekChange52 >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {formatPercent(stock.weekChange52)}
                        </TableCell>
                        <TableCell className="text-right text-cream/80">
                          {formatPrice(stock.weekHigh52)}
                        </TableCell>
                        <TableCell className="text-right">
                          {stock.chart && (
                            <Sparkline 
                              data={stock.chart} 
                              positive={stock.changePercent >= 0} 
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 text-red-400">
                  <Activity className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 