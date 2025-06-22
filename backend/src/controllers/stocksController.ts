import { Request, Response } from 'express'
import { StockData, MarketIndex, UserPortfolioStock } from '../types/stocks'
import https from 'https'
import http from 'http'

// Python yfinance service configuration
const PYTHON_STOCK_SERVICE_URL = process.env.PYTHON_STOCK_SERVICE_URL || 'http://localhost:5000'

class StocksController {
  // Helper method to call Python yfinance service
  private async callPythonService<T>(endpoint: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = `${PYTHON_STOCK_SERVICE_URL}${endpoint}`
      console.log(`Calling Python service: ${url}`)
      
      const client = url.startsWith('https') ? https : http
      
      client.get(url, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`Python service error: ${res.statusCode} - ${res.statusMessage}`))
              return
            }
            
            const jsonData = JSON.parse(data)
            console.log(`Python service response received successfully`)
            resolve(jsonData)
          } catch (error) {
            console.error(`Failed to parse Python service response:`, error)
            reject(error)
          }
        })
      }).on('error', (error) => {
        console.error(`Python service call failed:`, error)
        reject(error)
      })
    })
  }

  // Get market indices (NASDAQ, S&P 500, Dow Jones)
  async getMarketIndices(req: Request, res: Response) {
    try {
      const indices = await this.callPythonService<MarketIndex[]>('/api/market-indices')
      
      res.json({
        success: true,
        data: indices,
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
      
      const stocks = await this.callPythonService<StockData[]>(`/api/trending-stocks?limit=${limit}`)
      
      res.json({
        success: true,
        data: stocks,
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
      
      const portfolio = await this.callPythonService<UserPortfolioStock[]>(`/api/portfolio/${userId}`)
      
      res.json({
        success: true,
        data: portfolio,
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
      
      const stock = await this.callPythonService<StockData>(`/api/stock/${symbol}`)
      
      res.json({
        success: true,
        data: stock,
      })
    } catch (error) {
      console.error('Error fetching stock data:', error)
      res.status(500).json({
        success: false,
        error: `Failed to fetch data for ${req.params.symbol}`
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

      const results = await this.callPythonService<StockData[]>(`/api/search?q=${encodeURIComponent(q)}`)
      
      res.json({
        success: true,
        data: results,
      })
    } catch (error) {
      console.error('Error searching stocks:', error)
      res.status(500).json({
        success: false,
        error: 'Stock search failed'
      })
    }
  }
}

const stocksController = new StocksController()

export default {
  getMarketIndices: stocksController.getMarketIndices.bind(stocksController),
  getTrendingStocks: stocksController.getTrendingStocks.bind(stocksController),
  getUserPortfolio: stocksController.getUserPortfolio.bind(stocksController),
  getStockData: stocksController.getStockData.bind(stocksController),
  searchStocks: stocksController.searchStocks.bind(stocksController),
}

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