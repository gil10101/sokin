// Stock market data interfaces

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

export interface StockTransaction {
  id: string
  userId: string
  symbol: string
  transactionType: 'buy' | 'sell'
  shares: number
  pricePerShare: number
  totalAmount: number
  transactionDate: string
  createdAt: string
} 