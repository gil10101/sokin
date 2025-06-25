import { Request, Response } from 'express'
import { StockData, MarketIndex, UserPortfolioStock } from '../types/stocks'
import https from 'https'
import http from 'http'

// Python yfinance service configuration
const PYTHON_STOCK_SERVICE_URL = process.env.PYTHON_STOCK_SERVICE_URL || 'http://localhost:5000'

/**
 * StocksController handles all stock-related API endpoints
 * Interfaces with Python yfinance service for real-time stock data
 * 
 * @example
 * ```typescript
 * // Usage in routes
 * router.get('/stock/:symbol', stocksController.getStockData)
 * ```
 */
class StocksController {
  /**
   * Helper method to securely call Python yfinance service
   * Forwards authentication headers and implements timeout handling
   * 
   * @template T - The expected response type
   * @param endpoint - The API endpoint to call (e.g., '/api/stock/AAPL')
   * @param req - Express request object for forwarding auth headers
   * @returns Promise with the parsed response data
   * 
   * @throws {Error} When Python service is unavailable
   * @throws {Error} When response parsing fails
   * @throws {Error} When authentication fails
   * 
   * @example
   * ```typescript
   * const stockData = await this.callPythonService<StockData>('/api/stock/AAPL', req)
   * ```
   */
  private async callPythonService<T>(endpoint: string, req?: Request): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = `${PYTHON_STOCK_SERVICE_URL}${endpoint}`
      console.log(`Calling Python service: ${url}`)
      
      const client = url.startsWith('https') ? https : http
      
      // Set up headers with proper security
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Sokin-Backend/1.0',
      }
      
      // Forward Authorization header if available (for authenticated endpoints)
      if (req?.headers.authorization) {
        headers.Authorization = req.headers.authorization
      }
      
      const options = {
        headers,
        timeout: 30000, // 30 second timeout
      }
      
      const request = client.get(url, options, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              const errorMsg = `Python service error: ${res.statusCode} - ${res.statusMessage}`
              console.error(errorMsg)
              reject(new Error(errorMsg))
              return
            }
            
            const jsonData = JSON.parse(data)
            console.log(`Python service response received successfully`)
            resolve(jsonData)
          } catch (error) {
            console.error(`Failed to parse Python service response:`, error)
            reject(new Error('Invalid response from stock service'))
          }
        })
      })
      
      request.on('error', (error) => {
        console.error(`Python service call failed:`, error)
        reject(new Error('Stock service unavailable'))
      })
      
      request.on('timeout', () => {
        console.error('Python service request timeout')
        request.destroy()
        reject(new Error('Stock service timeout'))
      })
    })
  }

  /**
   * Get market indices (NASDAQ, S&P 500, Dow Jones)
   * Public endpoint - no authentication required
   * 
   * @param req - Express request object
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with market indices data
   * 
   * @example
   * Response format:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "^GSPC",
   *       "name": "S&P 500",
   *       "price": 4500.23,
   *       "change": 15.67,
   *       "changePercent": 0.35
   *     }
   *   ]
   * }
   * ```
   */
  async getMarketIndices(req: Request, res: Response): Promise<void> {
    try {
      const indices = await this.callPythonService<MarketIndex[]>('/api/market-indices', req)
      
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

  /**
   * Get trending stocks based on volume and price movement
   * Public endpoint with optional limit parameter
   * 
   * @param req - Express request object
   * @param req.query.limit - Optional limit for number of results (default: 10, max: 50)
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with trending stocks
   * 
   * @example
   * GET /api/trending?limit=5
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "AAPL",
   *       "name": "Apple Inc.",
   *       "price": 175.50,
   *       "change": 2.30,
   *       "changePercent": 1.33,
   *       "volume": 45000000
   *     }
   *   ]
   * }
   * ```
   */
  async getTrendingStocks(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 10 } = req.query
      
      // Input validation
      const parsedLimit = parseInt(limit as string)
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter (must be between 1 and 50)'
        })
        return
      }
      
      const stocks = await this.callPythonService<StockData[]>(`/api/trending-stocks?limit=${parsedLimit}`, req)
      
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

  /**
   * Get user's stock portfolio with real-time prices
   * Protected endpoint - requires authentication
   * 
   * @param req - Express request object
   * @param req.params.userId - User ID to fetch portfolio for
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with user portfolio
   * 
   * @security
   * - Requires valid Firebase authentication token
   * - User can only access their own portfolio data
   * 
   * @example
   * GET /api/portfolio/user123
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "AAPL",
   *       "shares": 10,
   *       "totalValue": 1755.00,
   *       "gainLoss": 55.00,
   *       "gainLossPercent": 3.24
   *     }
   *   ]
   * }
   * ```
   */
  async getUserPortfolio(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId
    
    try {
      // Security check: user can only access their own portfolio
      if (req.user?.uid !== userId) {
        this.logSecurityEvent(req, 'UNAUTHORIZED_PORTFOLIO_ACCESS', { 
          requestedUserId: userId,
          authenticatedUserId: req.user?.uid 
        })
        res.status(403).json({
          success: false,
          error: 'Access denied: Cannot access another user\'s portfolio'
        })
        return
      }
      
      // Log successful portfolio access for audit trail
      this.logSecurityEvent(req, 'PORTFOLIO_ACCESS_SUCCESS', { userId })
      
      const portfolio = await this.callPythonService<UserPortfolioStock[]>(`/api/portfolio/${userId}`, req)
      
      res.json({
        success: true,
        data: portfolio,
      })
    } catch (error) {
      console.error('Error fetching user portfolio:', error)
      
      this.logSecurityEvent(req, 'PORTFOLIO_ACCESS_FAILED', { 
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user portfolio'
      })
    }
  }

  /**
   * Get detailed data for a specific stock symbol
   * Public endpoint with input validation
   * 
   * @param req - Express request object
   * @param req.params.symbol - Stock symbol (e.g., 'AAPL', 'GOOGL')
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with stock data
   * 
   * @example
   * GET /api/stock/AAPL
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "symbol": "AAPL",
   *     "name": "Apple Inc.",
   *     "price": 175.50,
   *     "marketCap": "2.8T",
   *     "peRatio": 28.5,
   *     "weekHigh52": 182.94,
   *     "weekLow52": 124.17
   *   }
   * }
   * ```
   */
  async getStockData(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params
      
      // Input validation
      if (!symbol || !/^[A-Z^]{1,10}$/.test(symbol)) {
        res.status(400).json({
          success: false,
          error: 'Invalid stock symbol format'
        })
        return
      }
      
      const stock = await this.callPythonService<StockData>(`/api/stock/${symbol}`, req)
      
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

  /**
   * Search for stocks by symbol or company name
   * Public endpoint with comprehensive input validation
   * 
   * @param req - Express request object
   * @param req.query.q - Search query string
   * @param req.query.limit - Optional limit for results (default: 10, max: 25)
   * @param res - Express response object
   * 
   * @returns Promise<void> - Sends JSON response with search results
   * 
   * @example
   * GET /api/search?q=Apple&limit=5
   * Response:
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "symbol": "AAPL",
   *       "name": "Apple Inc.",
   *       "price": 175.50,
   *       "change": 2.30,
   *       "changePercent": 1.33
   *     }
   *   ]
   * }
   * ```
   */
  async searchStocks(req: Request, res: Response): Promise<void> {
    try {
      const { q, limit = 10 } = req.query
      
      // Input validation
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query is required'
        })
        return
      }
      
      if (q.length < 1 || q.length > 50) {
        res.status(400).json({
          success: false,
          error: 'Search query must be between 1 and 50 characters'
        })
        return
      }
      
      // Sanitize search query
      const sanitizedQuery = q.replace(/[^a-zA-Z0-9\s\.\-]/g, '')
      if (sanitizedQuery.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid search query format'
        })
        return
      }
      
      const parsedLimit = parseInt(limit as string)
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 25) {
        res.status(400).json({
          success: false,
          error: 'Invalid limit parameter (must be between 1 and 25)'
        })
        return
      }

      const results = await this.callPythonService<StockData[]>(`/api/search?q=${encodeURIComponent(sanitizedQuery)}&limit=${parsedLimit}`, req)
      
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

  /**
   * Enhanced input sanitization for stock symbols
   * 
   * @param symbol - Raw symbol input
   * @returns Sanitized and validated symbol
   * @throws {Error} When symbol format is invalid
   */
  private sanitizeStockSymbol(symbol: string): string {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Stock symbol is required')
    }
    
    // Remove any non-alphanumeric characters except ^ and convert to uppercase
    const cleaned = symbol.toUpperCase().replace(/[^A-Z0-9^]/g, '')
    
    // Validate length and format
    if (cleaned.length < 1 || cleaned.length > 10) {
      throw new Error('Stock symbol must be 1-10 characters')
    }
    
    // Ensure it matches expected pattern
    if (!/^[A-Z^]{1,10}$/.test(cleaned)) {
      throw new Error('Invalid stock symbol format')
    }
    
    return cleaned
  }

  /**
   * Security logging for suspicious activities
   * 
   * @param req - Express request object
   * @param action - Action being performed
   * @param details - Additional details for logging
   */
  private logSecurityEvent(req: Request, action: string, details: any = {}): void {
    const securityLog = {
      timestamp: new Date().toISOString(),
      action,
      userId: req.user?.uid || 'anonymous',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      ...details
    }
    
    console.log('SECURITY_EVENT:', JSON.stringify(securityLog))
  }
}

const stocksController = new StocksController()

/**
 * Exported controller methods for use in routes
 * All methods are bound to preserve 'this' context
 */
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