// Stock API service - mock data for now, easily replaceable with real API
export interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  marketCap: string
  peRatio: number | null
  weekHigh52: number
  weekLow52: number
  weekChange52: number
  chart?: number[] // Simple array of price points for sparkline
}

export interface MarketIndex {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
}

export interface UserPortfolioStock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  shares: number
  totalValue: number
  purchasePrice: number
  gainLoss: number
  gainLossPercent: number
}

// Mock data - replace with real API calls
const generateMockChart = (): number[] => {
  const points = []
  let price = 100 + Math.random() * 200
  for (let i = 0; i < 30; i++) {
    price += (Math.random() - 0.5) * 10
    points.push(Math.max(10, price))
  }
  return points
}

const mockMarketIndices: MarketIndex[] = [
  {
    symbol: "^IXIC",
    name: "NASDAQ Composite",
    price: 14256.45,
    change: 125.89,
    changePercent: 0.89,
  },
  {
    symbol: "^DJI",
    name: "Dow Jones Industrial Average",
    price: 33894.12,
    change: -89.23,
    changePercent: -0.26,
  },
  {
    symbol: "^GSPC",
    name: "S&P 500",
    price: 4384.65,
    change: 15.47,
    changePercent: 0.35,
  },
]

const mockTrendingStocks: StockData[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 178.25,
    change: 2.34,
    changePercent: 1.33,
    volume: 45678910,
    avgVolume: 52341234,
    marketCap: "2.8T",
    peRatio: 28.5,
    weekHigh52: 198.23,
    weekLow52: 164.08,
    weekChange52: 8.45,
    chart: generateMockChart(),
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    price: 134.89,
    change: -1.23,
    changePercent: -0.90,
    volume: 23456789,
    avgVolume: 28765432,
    marketCap: "1.7T",
    peRatio: 25.8,
    weekHigh52: 151.55,
    weekLow52: 83.34,
    weekChange52: 61.76,
    chart: generateMockChart(),
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    price: 238.45,
    change: 12.67,
    changePercent: 5.61,
    volume: 87654321,
    avgVolume: 76543210,
    marketCap: "758B",
    peRatio: 63.2,
    weekHigh52: 299.29,
    weekLow52: 138.80,
    weekChange52: 71.78,
    chart: generateMockChart(),
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    price: 378.92,
    change: -2.18,
    changePercent: -0.57,
    volume: 34567890,
    avgVolume: 32109876,
    marketCap: "2.8T",
    peRatio: 32.1,
    weekHigh52: 384.52,
    weekLow52: 309.45,
    weekChange52: 22.45,
    chart: generateMockChart(),
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    price: 892.34,
    change: 45.67,
    changePercent: 5.39,
    volume: 98765432,
    avgVolume: 85432109,
    marketCap: "2.2T",
    peRatio: 71.5,
    weekHigh52: 974.12,
    weekLow52: 180.96,
    weekChange52: 393.24,
    chart: generateMockChart(),
  },
  {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    price: 145.78,
    change: 3.45,
    changePercent: 2.42,
    volume: 56789012,
    avgVolume: 54321098,
    marketCap: "1.5T",
    peRatio: 48.7,
    weekHigh52: 170.15,
    weekLow52: 81.43,
    weekChange52: 79.04,
    chart: generateMockChart(),
  },
]

const mockUserPortfolio: UserPortfolioStock[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 178.25,
    change: 2.34,
    changePercent: 1.33,
    shares: 150,
    totalValue: 26737.50,
    purchasePrice: 165.00,
    gainLoss: 1987.50,
    gainLossPercent: 8.03,
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    price: 238.45,
    change: 12.67,
    changePercent: 5.61,
    shares: 75,
    totalValue: 17883.75,
    purchasePrice: 220.00,
    gainLoss: 1383.75,
    gainLossPercent: 8.39,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    price: 378.92,
    change: -2.18,
    changePercent: -0.57,
    shares: 40,
    totalValue: 15156.80,
    purchasePrice: 350.00,
    gainLoss: 1156.80,
    gainLossPercent: 8.27,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    price: 134.89,
    change: -1.23,
    changePercent: -0.90,
    shares: 85,
    totalValue: 11465.65,
    purchasePrice: 125.00,
    gainLoss: 840.65,
    gainLossPercent: 7.92,
  },
]

export class StockAPI {
  private static baseUrl = process.env.NEXT_PUBLIC_STOCK_API_URL || 'http://localhost:5000'

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }
    return response.json()
  }

  static async getMarketIndices(): Promise<MarketIndex[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/market-indices`)
      return await this.handleResponse<MarketIndex[]>(response)
    } catch (error) {
      console.error('Failed to fetch market indices:', error)
      // Fallback to mock data if API fails
      return mockMarketIndices
    }
  }

  static async getTrendingStocks(): Promise<StockData[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/trending-stocks`)
      return await this.handleResponse<StockData[]>(response)
    } catch (error) {
      console.error('Failed to fetch trending stocks:', error)
      // Fallback to mock data if API fails
      return mockTrendingStocks
    }
  }

  static async getUserPortfolio(userId: string): Promise<UserPortfolioStock[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/portfolio/${userId}`)
      return await this.handleResponse<UserPortfolioStock[]>(response)
    } catch (error) {
      console.error('Failed to fetch user portfolio:', error)
      // Fallback to mock data if API fails
      return mockUserPortfolio.sort((a, b) => b.totalValue - a.totalValue)
    }
  }

  static async getStockData(symbol: string): Promise<StockData | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stock/${symbol}`)
      return await this.handleResponse<StockData>(response)
    } catch (error) {
      console.error(`Failed to fetch stock data for ${symbol}:`, error)
      // Fallback to mock data if API fails
      return mockTrendingStocks.find(stock => stock.symbol === symbol) || null
    }
  }

  static async searchStocks(query: string): Promise<StockData[]> {
    if (!query.trim()) {
      return []
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/search?q=${encodeURIComponent(query)}`)
      return await this.handleResponse<StockData[]>(response)
    } catch (error) {
      console.error('Failed to search stocks:', error)
      // Fallback to mock data if API fails
      return mockTrendingStocks.filter(stock => 
        stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
        stock.name.toLowerCase().includes(query.toLowerCase())
      )
    }
  }
}

// Utility functions
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

export const formatChange = (change: number): string => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}`
}

export const formatPercent = (percent: number): string => {
  const sign = percent >= 0 ? '+' : ''
  return `${sign}${percent.toFixed(2)}%`
}

export const formatVolume = (volume: number): string => {
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(1)}B`
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(1)}M`
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(1)}K`
  }
  return volume.toString()
} 