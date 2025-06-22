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
    async callPythonService(endpoint) {
        return new Promise((resolve, reject) => {
            const url = `${PYTHON_STOCK_SERVICE_URL}${endpoint}`;
            const client = url.startsWith('https') ? https_1.default : http_1.default;
            client.get(url, (res) => {
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
                        resolve(jsonData);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }
    // Get market indices (NASDAQ, S&P 500, Dow Jones)
    async getMarketIndices(req, res) {
        try {
            const indices = await this.callPythonService('/api/market-indices');
            res.json({
                success: true,
                data: indices,
            });
        }
        catch (error) {
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
            const stocks = await this.callPythonService(`/api/trending-stocks?limit=${limit}`);
            res.json({
                success: true,
                data: stocks,
            });
        }
        catch (error) {
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
            const portfolio = await this.callPythonService(`/api/portfolio/${userId}`);
            res.json({
                success: true,
                data: portfolio,
            });
        }
        catch (error) {
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
            const stock = await this.callPythonService(`/api/stock/${symbol}`);
            res.json({
                success: true,
                data: stock,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch stock data'
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
            const results = await this.callPythonService(`/api/search?q=${encodeURIComponent(q)}`);
            res.json({
                success: true,
                data: results,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to search stocks'
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
