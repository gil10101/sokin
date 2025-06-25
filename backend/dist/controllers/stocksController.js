"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
// Python yfinance service configuration
const PYTHON_STOCK_SERVICE_URL = process.env.PYTHON_STOCK_SERVICE_URL || 'http://localhost:5000';
class StocksController {
    // Helper method to call Python yfinance service
    async callPythonService(endpoint, req) {
        return new Promise((resolve, reject) => {
            const url = `${PYTHON_STOCK_SERVICE_URL}${endpoint}`;
            console.log(`Calling Python service: ${url}`);
            const client = url.startsWith('https') ? https_1.default : http_1.default;
            // Set up headers
            const headers = {
                'Content-Type': 'application/json',
            };
            // Forward Authorization header if available (for authenticated endpoints)
            if (req === null || req === void 0 ? void 0 : req.headers.authorization) {
                headers.Authorization = req.headers.authorization;
            }
            const options = {
                headers
            };
            client.get(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            reject(new Error(`Python service error: ${res.statusCode} - ${res.statusMessage}`));
                            return;
                        }
                        const jsonData = JSON.parse(data);
                        console.log(`Python service response received successfully`);
                        resolve(jsonData);
                    }
                    catch (error) {
                        console.error(`Failed to parse Python service response:`, error);
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                console.error(`Python service call failed:`, error);
                reject(error);
            });
        });
    }
    // Get market indices (NASDAQ, S&P 500, Dow Jones)
    async getMarketIndices(req, res) {
        try {
            const indices = await this.callPythonService('/api/market-indices', req);
            res.json({
                success: true,
                data: indices,
            });
        }
        catch (error) {
            console.error('Error fetching market indices:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch market indices'
            });
        }
    }
    // Get trending stocks
    async getTrendingStocks(req, res) {
        try {
            const { limit = 10 } = req.query;
            const stocks = await this.callPythonService(`/api/trending-stocks?limit=${limit}`, req);
            res.json({
                success: true,
                data: stocks,
            });
        }
        catch (error) {
            console.error('Error fetching trending stocks:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch trending stocks'
            });
        }
    }
    // Get user's portfolio
    async getUserPortfolio(req, res) {
        try {
            const userId = req.params.userId;
            const portfolio = await this.callPythonService(`/api/portfolio/${userId}`, req);
            res.json({
                success: true,
                data: portfolio,
            });
        }
        catch (error) {
            console.error('Error fetching user portfolio:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user portfolio'
            });
        }
    }
    // Get specific stock data
    async getStockData(req, res) {
        try {
            const { symbol } = req.params;
            const stock = await this.callPythonService(`/api/stock/${symbol}`, req);
            res.json({
                success: true,
                data: stock,
            });
        }
        catch (error) {
            console.error('Error fetching stock data:', error);
            res.status(500).json({
                success: false,
                error: `Failed to fetch data for ${req.params.symbol}`
            });
        }
    }
    // Search stocks
    async searchStocks(req, res) {
        try {
            const { q } = req.query;
            if (!q || typeof q !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Search query is required'
                });
            }
            const results = await this.callPythonService(`/api/search?q=${encodeURIComponent(q)}`, req);
            res.json({
                success: true,
                data: results,
            });
        }
        catch (error) {
            console.error('Error searching stocks:', error);
            res.status(500).json({
                success: false,
                error: 'Stock search failed'
            });
        }
    }
}
const stocksController = new StocksController();
exports.default = {
    getMarketIndices: stocksController.getMarketIndices.bind(stocksController),
    getTrendingStocks: stocksController.getTrendingStocks.bind(stocksController),
    getUserPortfolio: stocksController.getUserPortfolio.bind(stocksController),
    getStockData: stocksController.getStockData.bind(stocksController),
    searchStocks: stocksController.searchStocks.bind(stocksController),
};
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
