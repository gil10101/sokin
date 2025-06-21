import { Request, Response } from 'express'
import { StockData, MarketIndex, UserPortfolioStock } from '../types/stocks'

// Example of how to integrate with a Python service using yfinance
// This would require a separate Python microservice or API endpoint

interface YFinanceResponse {
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
  chart: number[]
}

class StocksController {
  // Get market indices (NASDAQ, S&P 500, Dow Jones)
  async getMarketIndices(req: Request, res: Response) {
    try {
      // In a real implementation, this would call a Python service
      // Example: const response = await fetch('http://python-service:5000/api/market-indices')
      
      const mockIndices: MarketIndex[] = [
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

      res.json({
        success: true,
        data: mockIndices,
      })
    } catch (error) {
      console.error('Error fetching market indices:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch market indices'
      })
    }
  }

  // Get trending stocks
  async getTrendingStocks(req: Request, res: Response) {
    try {
      const { limit = 10 } = req.query
      
      // In a real implementation, this would call the Python yfinance service
      // Example Python service endpoint: /api/trending-stocks?limit=10
      
      const mockStocks: StockData[] = [
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
        // ... more stocks
      ]

      res.json({
        success: true,
        data: mockStocks.slice(0, Number(limit)),
      })
    } catch (error) {
      console.error('Error fetching trending stocks:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trending stocks'
      })
    }
  }

  // Get user's portfolio
  async getUserPortfolio(req: Request, res: Response) {
    try {
      const userId = req.params.userId
      
      // In a real implementation, this would:
      // 1. Fetch user's stock holdings from database
      // 2. Get current prices from Python yfinance service
      // 3. Calculate gains/losses
      
      const mockPortfolio: UserPortfolioStock[] = [
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
        // ... more holdings
      ]

      // Sort by total value descending
      const sortedPortfolio = mockPortfolio.sort((a, b) => b.totalValue - a.totalValue)

      res.json({
        success: true,
        data: sortedPortfolio,
      })
    } catch (error) {
      console.error('Error fetching user portfolio:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user portfolio'
      })
    }
  }

  // Get specific stock data
  async getStockData(req: Request, res: Response) {
    try {
      const { symbol } = req.params
      
      // In a real implementation, this would call:
      // const response = await fetch(`http://python-service:5000/api/stock/${symbol}`)
      
      const mockStock: StockData = {
        symbol: symbol.toUpperCase(),
        name: "Mock Company Inc.",
        price: 150.00,
        change: 2.50,
        changePercent: 1.69,
        volume: 1000000,
        avgVolume: 1200000,
        marketCap: "500B",
        peRatio: 25.0,
        weekHigh52: 180.00,
        weekLow52: 120.00,
        weekChange52: 25.00,
        chart: generateMockChart(),
      }

      res.json({
        success: true,
        data: mockStock,
      })
    } catch (error) {
      console.error('Error fetching stock data:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stock data'
      })
    }
  }

  // Search stocks
  async searchStocks(req: Request, res: Response) {
    try {
      const { q } = req.query
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        })
      }

      // In a real implementation, this would call:
      // const response = await fetch(`http://python-service:5000/api/search?q=${encodeURIComponent(q)}`)
      
      const mockResults: StockData[] = [
        // Mock search results based on query
      ]

      res.json({
        success: true,
        data: mockResults,
      })
    } catch (error) {
      console.error('Error searching stocks:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to search stocks'
      })
    }
  }
}

// Helper function to generate mock chart data
function generateMockChart(): number[] {
  const points = []
  let price = 100 + Math.random() * 200
  for (let i = 0; i < 30; i++) {
    price += (Math.random() - 0.5) * 10
    points.push(Math.max(10, price))
  }
  return points
}

export default new StocksController()

/*
Example Python service using yfinance:

```python
# stock_service.py
import yfinance as yf
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/market-indices')
def get_market_indices():
    symbols = ['^IXIC', '^DJI', '^GSPC']
    indices = []
    
    for symbol in symbols:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        hist = ticker.history(period='2d')
        
        current_price = hist['Close'].iloc[-1]
        prev_price = hist['Close'].iloc[-2]
        change = current_price - prev_price
        change_percent = (change / prev_price) * 100
        
        indices.append({
            'symbol': symbol,
            'name': info.get('longName', symbol),
            'price': current_price,
            'change': change,
            'changePercent': change_percent
        })
    
    return jsonify(indices)

@app.route('/api/trending-stocks')
def get_trending_stocks():
    # Implementation for trending stocks
    pass

@app.route('/api/stock/<symbol>')
def get_stock_data(symbol):
    ticker = yf.Ticker(symbol)
    info = ticker.info
    hist = ticker.history(period='1y')
    
    # Calculate metrics and return stock data
    pass

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

To use this with Docker:

```dockerfile
# Dockerfile for Python service
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "stock_service.py"]
```

requirements.txt:
```
yfinance==0.2.28
flask==2.3.3
flask-cors==4.0.0
pandas==2.1.0
numpy==1.24.3
```
*/ 