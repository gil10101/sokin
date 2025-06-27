"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const firebase_1 = require("../config/firebase");
// Python yfinance service configuration
const PYTHON_STOCK_SERVICE_URL = process.env.PYTHON_STOCK_SERVICE_URL || 'http://localhost:5000';
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
    async callPythonService(endpoint, req) {
        return new Promise((resolve, reject) => {
            const url = `${PYTHON_STOCK_SERVICE_URL}${endpoint}`;
            console.log(`Calling Python service: ${url}`);
            const client = url.startsWith('https') ? https_1.default : http_1.default;
            // Set up headers with proper security
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Sokin-Backend/1.0',
            };
            // Forward Authorization header if available (for authenticated endpoints)
            if (req === null || req === void 0 ? void 0 : req.headers.authorization) {
                headers.Authorization = req.headers.authorization;
            }
            const options = {
                headers,
                timeout: 30000, // 30 second timeout
            };
            const request = client.get(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) {
                            const errorMsg = `Python service error: ${res.statusCode} - ${res.statusMessage}`;
                            console.error(errorMsg);
                            reject(new Error(errorMsg));
                            return;
                        }
                        const jsonData = JSON.parse(data);
                        console.log(`Python service response received successfully`);
                        resolve(jsonData);
                    }
                    catch (error) {
                        console.error(`Failed to parse Python service response:`, error);
                        reject(new Error('Invalid response from stock service'));
                    }
                });
            });
            request.on('error', (error) => {
                console.error(`Python service call failed:`, error);
                reject(new Error('Stock service unavailable'));
            });
            request.on('timeout', () => {
                console.error('Python service request timeout');
                request.destroy();
                reject(new Error('Stock service timeout'));
            });
        });
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
    async getTrendingStocks(req, res) {
        try {
            const { limit = 10 } = req.query;
            // Input validation
            const parsedLimit = parseInt(limit);
            if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid limit parameter (must be between 1 and 50)'
                });
                return;
            }
            const stocks = await this.callPythonService(`/api/trending-stocks?limit=${parsedLimit}`, req);
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
    async getUserPortfolio(req, res) {
        var _a, _b;
        const userId = req.params.userId;
        try {
            // Security check: user can only access their own portfolio
            if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) !== userId) {
                this.logSecurityEvent(req, 'UNAUTHORIZED_PORTFOLIO_ACCESS', {
                    requestedUserId: userId,
                    authenticatedUserId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
                });
                res.status(403).json({
                    success: false,
                    error: 'Access denied: Cannot access another user\'s portfolio'
                });
                return;
            }
            // Log successful portfolio access for audit trail
            this.logSecurityEvent(req, 'PORTFOLIO_ACCESS_SUCCESS', { userId });
            // Get portfolio from Firebase instead of Python service
            const portfolio = await this.calculateUserPortfolioFromFirebase(userId);
            res.json({
                success: true,
                data: portfolio,
            });
        }
        catch (error) {
            console.error('Error fetching user portfolio:', error);
            this.logSecurityEvent(req, 'PORTFOLIO_ACCESS_FAILED', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user portfolio'
            });
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
    async getStockData(req, res) {
        try {
            const { symbol } = req.params;
            // Input validation
            if (!symbol || !/^[A-Z^]{1,10}$/.test(symbol)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid stock symbol format'
                });
                return;
            }
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
    async searchStocks(req, res) {
        try {
            const { q, limit = 10 } = req.query;
            // Input validation
            if (!q || typeof q !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Search query is required'
                });
                return;
            }
            if (q.length < 1 || q.length > 50) {
                res.status(400).json({
                    success: false,
                    error: 'Search query must be between 1 and 50 characters'
                });
                return;
            }
            // Sanitize search query
            const sanitizedQuery = q.replace(/[^a-zA-Z0-9\s\.\-]/g, '');
            if (sanitizedQuery.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid search query format'
                });
                return;
            }
            const parsedLimit = parseInt(limit);
            if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 25) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid limit parameter (must be between 1 and 25)'
                });
                return;
            }
            const results = await this.callPythonService(`/api/search?q=${encodeURIComponent(sanitizedQuery)}&limit=${parsedLimit}`, req);
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
    /**
     * Enhanced input sanitization for stock symbols
     *
     * @param symbol - Raw symbol input
     * @returns Sanitized and validated symbol
     * @throws {Error} When symbol format is invalid
     */
    sanitizeStockSymbol(symbol) {
        if (!symbol || typeof symbol !== 'string') {
            throw new Error('Stock symbol is required');
        }
        // Remove any non-alphanumeric characters except ^ and convert to uppercase
        const cleaned = symbol.toUpperCase().replace(/[^A-Z0-9^]/g, '');
        // Validate length and format
        if (cleaned.length < 1 || cleaned.length > 10) {
            throw new Error('Stock symbol must be 1-10 characters');
        }
        // Ensure it matches expected pattern
        if (!/^[A-Z^]{1,10}$/.test(cleaned)) {
            throw new Error('Invalid stock symbol format');
        }
        return cleaned;
    }
    /**
     * Calculate user portfolio from Firebase transactions
     * Aggregates all transactions and gets current stock prices
     *
     * @param userId - User ID to calculate portfolio for
     * @returns Promise resolving to portfolio stocks with current values
     */
    async calculateUserPortfolioFromFirebase(userId) {
        if (!firebase_1.db) {
            throw new Error('Firestore not initialized');
        }
        try {
            // Get all transactions for the user using Firebase Admin SDK
            const transactionsSnapshot = await firebase_1.db
                .collection('stockTransactions')
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .get();
            const transactions = transactionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Aggregate holdings by symbol
            const holdings = new Map();
            for (const transaction of transactions) {
                const existing = holdings.get(transaction.symbol) || { shares: 0, totalInvested: 0, avgPrice: 0 };
                if (transaction.transactionType === 'buy') {
                    const newShares = existing.shares + transaction.shares;
                    const newTotalInvested = existing.totalInvested + transaction.totalAmount;
                    holdings.set(transaction.symbol, {
                        shares: newShares,
                        totalInvested: newTotalInvested,
                        avgPrice: newTotalInvested / newShares
                    });
                }
                else if (transaction.transactionType === 'sell') {
                    const newShares = Math.max(0, existing.shares - transaction.shares);
                    const proportionSold = transaction.shares / existing.shares;
                    const newTotalInvested = existing.totalInvested * (1 - proportionSold);
                    if (newShares > 0) {
                        holdings.set(transaction.symbol, {
                            shares: newShares,
                            totalInvested: newTotalInvested,
                            avgPrice: newTotalInvested / newShares
                        });
                    }
                    else {
                        holdings.delete(transaction.symbol);
                    }
                }
            }
            // Convert holdings to portfolio stocks with current prices
            const portfolioStocks = [];
            for (const [symbol, holding] of holdings) {
                try {
                    // Get current stock data
                    const currentStockData = await this.callPythonService(`/api/stock/${symbol}`);
                    const totalValue = holding.shares * currentStockData.price;
                    const gainLoss = totalValue - holding.totalInvested;
                    const gainLossPercent = holding.totalInvested > 0 ? (gainLoss / holding.totalInvested) * 100 : 0;
                    portfolioStocks.push({
                        symbol: currentStockData.symbol,
                        name: currentStockData.name,
                        price: currentStockData.price,
                        change: currentStockData.change,
                        changePercent: currentStockData.changePercent,
                        shares: holding.shares,
                        totalValue,
                        purchasePrice: holding.avgPrice,
                        gainLoss,
                        gainLossPercent
                    });
                }
                catch (stockError) {
                    console.error(`Failed to get current price for ${symbol}:`, stockError);
                    // Include holding with last known data if stock service fails
                    portfolioStocks.push({
                        symbol,
                        name: symbol, // Fallback to symbol as name
                        price: holding.avgPrice,
                        change: 0,
                        changePercent: 0,
                        shares: holding.shares,
                        totalValue: holding.shares * holding.avgPrice,
                        purchasePrice: holding.avgPrice,
                        gainLoss: 0,
                        gainLossPercent: 0
                    });
                }
            }
            return portfolioStocks.sort((a, b) => b.totalValue - a.totalValue); // Sort by total value descending
        }
        catch (error) {
            console.error('Error calculating portfolio from Firebase:', error);
            throw new Error('Failed to calculate portfolio');
        }
    }
    /**
     * Save transaction to Firebase
     *
     * @param transaction - Transaction data to save
     * @returns Promise resolving when transaction is saved
     */
    async saveTransactionToFirebase(transaction) {
        if (!firebase_1.db) {
            throw new Error('Firestore not initialized');
        }
        try {
            await firebase_1.db.collection('stockTransactions').add({
                ...transaction,
                timestamp: new Date()
            });
            console.log(`Transaction saved to Firebase: ${transaction.transactionType} ${transaction.shares} shares of ${transaction.symbol}`);
        }
        catch (error) {
            console.error('Failed to save transaction to Firebase:', error);
            throw new Error('Failed to save transaction');
        }
    }
    /**
     * Security logging for suspicious activities
     *
     * @param req - Express request object
     * @param action - Action being performed
     * @param details - Additional details for logging
     */
    logSecurityEvent(req, action, details = {}) {
        var _a;
        const securityLog = {
            timestamp: new Date().toISOString(),
            action,
            userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || 'anonymous',
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            endpoint: req.originalUrl,
            method: req.method,
            ...details
        };
        console.log('SECURITY_EVENT:', JSON.stringify(securityLog));
    }
    /**
     * Execute a stock transaction (buy/sell) with validation
     * Protected endpoint - requires authentication
     *
     * @param req - Express request object
     * @param req.body.symbol - Stock symbol
     * @param req.body.type - Transaction type ('buy' or 'sell')
     * @param req.body.amount - Dollar amount for transaction
     * @param req.body.price - Current stock price
     * @param res - Express response object
     *
     * @returns Promise<void> - Sends JSON response confirming transaction
     */
    async executeTransaction(req, res) {
        var _a;
        try {
            const { symbol, type, amount, price } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }
            // Input validation
            if (!symbol || !type || !amount || !price) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: symbol, type, amount, price'
                });
                return;
            }
            if (type !== 'buy' && type !== 'sell') {
                res.status(400).json({
                    success: false,
                    error: 'Transaction type must be buy or sell'
                });
                return;
            }
            const numericAmount = parseFloat(amount);
            const numericPrice = parseFloat(price);
            if (isNaN(numericAmount) || numericAmount <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'Amount must be a positive number'
                });
                return;
            }
            if (isNaN(numericPrice) || numericPrice <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'Price must be a positive number'
                });
                return;
            }
            // Calculate shares (round to 2 decimal places)
            const shares = Math.floor(numericAmount / numericPrice * 100) / 100;
            if (shares <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'Transaction amount is too small to purchase any shares'
                });
                return;
            }
            // For sell transactions, validate user has enough shares
            if (type === 'sell') {
                try {
                    const portfolio = await this.calculateUserPortfolioFromFirebase(userId);
                    const holding = portfolio.find(stock => stock.symbol === symbol);
                    if (!holding) {
                        res.status(400).json({
                            success: false,
                            error: `Cannot sell ${symbol} - you don't own any shares of this stock`
                        });
                        return;
                    }
                    if (holding.shares < shares) {
                        res.status(400).json({
                            success: false,
                            error: `Cannot sell ${shares} shares of ${symbol} - you only own ${holding.shares} shares`
                        });
                        return;
                    }
                }
                catch (portfolioError) {
                    console.error('Error validating portfolio for sell transaction:', portfolioError);
                    res.status(500).json({
                        success: false,
                        error: 'Failed to validate portfolio holdings'
                    });
                    return;
                }
            }
            // Execute transaction and save to Firebase
            const sanitizedSymbol = this.sanitizeStockSymbol(symbol);
            try {
                await this.saveTransactionToFirebase({
                    userId,
                    symbol: sanitizedSymbol,
                    transactionType: type,
                    shares,
                    pricePerShare: numericPrice,
                    totalAmount: shares * numericPrice,
                    transactionDate: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                });
                this.logSecurityEvent(req, 'TRANSACTION_EXECUTED', {
                    symbol: sanitizedSymbol,
                    type,
                    amount: numericAmount,
                    shares,
                    price: numericPrice
                });
                res.json({
                    success: true,
                    message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${shares} shares of ${sanitizedSymbol}`,
                    data: {
                        symbol: sanitizedSymbol,
                        type,
                        shares,
                        price: numericPrice,
                        totalValue: shares * numericPrice
                    }
                });
            }
            catch (transactionError) {
                console.error('Transaction execution failed:', transactionError);
                res.status(500).json({
                    success: false,
                    error: 'Failed to execute transaction'
                });
            }
        }
        catch (error) {
            console.error('Error in executeTransaction:', error);
            res.status(500).json({
                success: false,
                error: 'Transaction failed'
            });
        }
    }
    /**
     * Get maximum sellable amount for a stock
     * Protected endpoint - requires authentication
     *
     * @param req - Express request object
     * @param req.params.symbol - Stock symbol
     * @param res - Express response object
     *
     * @returns Promise<void> - Sends JSON response with max sell info
     */
    async getMaxSellAmount(req, res) {
        var _a;
        try {
            const { symbol } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }
            if (!symbol) {
                res.status(400).json({
                    success: false,
                    error: 'Stock symbol is required'
                });
                return;
            }
            const sanitizedSymbol = this.sanitizeStockSymbol(symbol);
            try {
                // Get user's portfolio from Firebase
                const portfolio = await this.calculateUserPortfolioFromFirebase(userId);
                const holding = portfolio.find(stock => stock.symbol === sanitizedSymbol);
                if (!holding) {
                    res.json({
                        success: true,
                        data: {
                            shares: 0,
                            value: 0,
                            price: 0
                        }
                    });
                    return;
                }
                // Get current stock price
                try {
                    const stockData = await this.callPythonService(`/api/stock/${sanitizedSymbol}`);
                    res.json({
                        success: true,
                        data: {
                            shares: holding.shares,
                            value: holding.shares * stockData.price,
                            price: stockData.price
                        }
                    });
                }
                catch (priceError) {
                    // Fallback to purchase price if current price unavailable
                    res.json({
                        success: true,
                        data: {
                            shares: holding.shares,
                            value: holding.shares * holding.purchasePrice,
                            price: holding.purchasePrice
                        }
                    });
                }
            }
            catch (portfolioError) {
                console.error('Error getting portfolio for max sell amount:', portfolioError);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve portfolio information'
                });
            }
        }
        catch (error) {
            console.error('Error in getMaxSellAmount:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get maximum sell amount'
            });
        }
    }
    /**
     * Get user's transaction history
     * Protected endpoint - requires authentication
     *
     * @param req - Express request object
     * @param req.query.limit - Optional limit for results (default: 50, max: 100)
     * @param res - Express response object
     *
     * @returns Promise<void> - Sends JSON response with transaction history
     */
    async getTransactionHistory(req, res) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { limit = 50 } = req.query;
            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }
            const parsedLimit = parseInt(limit);
            if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid limit parameter (must be between 1 and 100)'
                });
                return;
            }
            try {
                if (!firebase_1.db) {
                    throw new Error('Firestore not initialized');
                }
                const transactionsSnapshot = await firebase_1.db
                    .collection('stockTransactions')
                    .where('userId', '==', userId)
                    .orderBy('timestamp', 'desc')
                    .limit(parsedLimit)
                    .get();
                const transactions = transactionsSnapshot.docs.map(doc => {
                    var _a, _b;
                    return ({
                        id: doc.id,
                        ...doc.data(),
                        timestamp: ((_b = (_a = doc.data().timestamp) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || doc.data().timestamp
                    });
                });
                res.json({
                    success: true,
                    data: transactions
                });
            }
            catch (serviceError) {
                console.error('Error getting transaction history from Firebase:', serviceError);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve transaction history'
                });
            }
        }
        catch (error) {
            console.error('Error in getTransactionHistory:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get transaction history'
            });
        }
    }
}
const stocksController = new StocksController();
/**
 * Exported controller methods for use in routes
 * All methods are bound to preserve 'this' context
 */
exports.default = {
    getMarketIndices: stocksController.getMarketIndices.bind(stocksController),
    getTrendingStocks: stocksController.getTrendingStocks.bind(stocksController),
    getUserPortfolio: stocksController.getUserPortfolio.bind(stocksController),
    getStockData: stocksController.getStockData.bind(stocksController),
    searchStocks: stocksController.searchStocks.bind(stocksController),
    executeTransaction: stocksController.executeTransaction.bind(stocksController),
    getMaxSellAmount: stocksController.getMaxSellAmount.bind(stocksController),
    getTransactionHistory: stocksController.getTransactionHistory.bind(stocksController),
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
