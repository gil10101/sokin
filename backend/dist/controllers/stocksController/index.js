"use strict";
/**
 * Stocks Controller
 *
 * Handles stock market data endpoints using Finnhub API.
 * Provides market indices, trending stocks, search, portfolio management,
 * and transaction execution.
 *
 * @module controllers/stocksController
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const cache_1 = __importStar(require("../../utils/cache"));
const logger_1 = __importDefault(require("../../utils/logger"));
const finnhubService_1 = require("./finnhubService");
// ============================================================================
// Cache Key Builders
// ============================================================================
/**
 * Build cache key for user portfolio
 */
function buildPortfolioCacheKey(userId) {
    return `portfolio:${userId}`;
}
/**
 * Build cache key for transaction history
 */
function buildTransactionHistoryCacheKey(userId, limit) {
    return `transactions:${userId}:${limit}`;
}
// ============================================================================
// Utility Functions
// ============================================================================
function sanitizeStockSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string')
        throw new Error('Stock symbol is required');
    const cleaned = symbol.toUpperCase().replace(/[^A-Z0-9^]/g, '');
    if (cleaned.length < 1 || cleaned.length > 10)
        throw new Error('Stock symbol must be 1-10 characters');
    if (!finnhubService_1.STOCK_SYMBOL_PATTERN.test(cleaned))
        throw new Error('Invalid stock symbol format');
    return cleaned;
}
function sanitizeSearchQuery(query) {
    if (!query || typeof query !== 'string')
        return '';
    return query.replace(/[^a-zA-Z0-9\s\.\-]/g, '');
}
function logSecurityEvent(req, action, details = {}) {
    var _a, _b;
    logger_1.default.info('Security Event', {
        timestamp: new Date().toISOString(),
        action,
        userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || 'anonymous',
        ip: req.ip || ((_b = req.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress),
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        ...details
    });
}
function parseLimit(value, defaultValue, min, max) {
    if (value === undefined || value === null)
        return { valid: true, value: defaultValue };
    const parsed = parseInt(value);
    if (isNaN(parsed))
        return { valid: false, error: 'Invalid limit parameter (must be a number)' };
    if (parsed < min || parsed > max)
        return { valid: false, error: `Invalid limit parameter (must be between ${min} and ${max})` };
    return { valid: true, value: parsed };
}
// ============================================================================
// Portfolio Calculation
// ============================================================================
async function calculateUserPortfolioFromFirebase(userId) {
    if (!firebase_1.db)
        throw new Error('Firestore not initialized');
    // Order by ascending timestamp to process buys before sells chronologically
    const transactionsSnapshot = await firebase_1.db
        .collection('stockTransactions')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .get();
    const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const holdings = new Map();
    for (const tx of transactions) {
        const existing = holdings.get(tx.symbol) || { shares: 0, totalInvested: 0, avgPrice: 0 };
        if (tx.transactionType === 'buy') {
            const newShares = existing.shares + tx.shares;
            const newTotalInvested = existing.totalInvested + tx.totalAmount;
            holdings.set(tx.symbol, { shares: newShares, totalInvested: newTotalInvested, avgPrice: newTotalInvested / newShares });
        }
        else if (tx.transactionType === 'sell') {
            // Guard against division by zero when processing sells
            if (existing.shares <= 0) {
                logger_1.default.warn('Sell transaction with no existing holdings', { symbol: tx.symbol, userId });
                continue;
            }
            const newShares = Math.max(0, existing.shares - tx.shares);
            // Clamp proportionSold to prevent negative totalInvested from data inconsistency
            const proportionSold = Math.min(1, tx.shares / existing.shares);
            const newTotalInvested = existing.totalInvested * (1 - proportionSold);
            if (newShares > 0) {
                holdings.set(tx.symbol, { shares: newShares, totalInvested: newTotalInvested, avgPrice: newTotalInvested / newShares });
            }
            else {
                holdings.delete(tx.symbol);
            }
        }
    }
    // Early return if no holdings
    if (holdings.size === 0) {
        return [];
    }
    // Collect all symbols and their holdings for batch processing
    const holdingsArray = Array.from(holdings.entries());
    const symbols = holdingsArray.map(([symbol]) => symbol);
    // Batch fetch all stock data in parallel
    const stockDataResults = await (0, finnhubService_1.processBatchedRequests)(symbols.map(symbol => () => (0, finnhubService_1.getFullStockData)(symbol, false).catch(() => null)));
    // Create a map of symbol -> stock data for efficient lookup
    const stockDataMap = new Map();
    symbols.forEach((symbol, index) => {
        stockDataMap.set(symbol, stockDataResults[index]);
    });
    // Build portfolio with fetched stock data
    const portfolioStocks = holdingsArray.map(([symbol, holding]) => {
        const stockData = stockDataMap.get(symbol);
        if (stockData && stockData.price > 0) {
            const totalValue = holding.shares * stockData.price;
            const gainLoss = totalValue - holding.totalInvested;
            const gainLossPercent = holding.totalInvested > 0 ? (gainLoss / holding.totalInvested) * 100 : 0;
            return {
                symbol: stockData.symbol,
                name: stockData.name,
                price: stockData.price,
                change: stockData.change,
                changePercent: stockData.changePercent,
                shares: holding.shares,
                totalValue,
                purchasePrice: holding.avgPrice,
                gainLoss,
                gainLossPercent
            };
        }
        // Fallback when stock data fetch failed
        return {
            symbol,
            name: symbol,
            price: holding.avgPrice,
            change: 0,
            changePercent: 0,
            shares: holding.shares,
            totalValue: holding.shares * holding.avgPrice,
            purchasePrice: holding.avgPrice,
            gainLoss: 0,
            gainLossPercent: 0
        };
    });
    return portfolioStocks.sort((a, b) => b.totalValue - a.totalValue);
}
async function saveTransactionToFirebase(transaction) {
    if (!firebase_1.db)
        throw new Error('Firestore not initialized');
    // Always save timestamp as Firestore Timestamp for proper querying and indexing
    const now = firestore_1.Timestamp.now();
    await firebase_1.db.collection('stockTransactions').add({
        ...transaction,
        timestamp: now
    });
}
// ============================================================================
// Controller Endpoints
// ============================================================================
async function getMarketIndices(req, res, next) {
    try {
        const indices = [];
        const quotes = await Promise.all(finnhubService_1.MARKET_INDEX_SYMBOLS.map(s => (0, finnhubService_1.getMarketIndexQuote)(s).catch(() => null)));
        for (let i = 0; i < finnhubService_1.MARKET_INDEX_SYMBOLS.length; i++) {
            const symbol = finnhubService_1.MARKET_INDEX_SYMBOLS[i];
            const quote = quotes[i];
            if (quote && quote.c > 0) {
                indices.push((0, finnhubService_1.convertQuoteToMarketIndex)(quote, finnhubService_1.INDEX_NAME_MAPPING[symbol], finnhubService_1.TRADITIONAL_SYMBOL_MAPPING[symbol]));
            }
        }
        if (indices.length === finnhubService_1.MARKET_INDEX_SYMBOLS.length) {
            res.json({ success: true, data: indices });
        }
        else {
            throw new Error('Some indices missing from Finnhub response');
        }
    }
    catch (error) {
        logger_1.default.error('Failed to fetch market indices', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ success: false, error: 'Failed to fetch market indices' });
    }
}
async function getTrendingStocks(req, res, next) {
    try {
        const limitResult = parseLimit(req.query.limit, finnhubService_1.LIMITS.DEFAULT_TRENDING, 1, finnhubService_1.LIMITS.MAX_TRENDING);
        if (!limitResult.valid) {
            res.status(400).json({ success: false, error: limitResult.error });
            return;
        }
        const cacheKey = `trending_stocks:${limitResult.value}`;
        // Try distributed cache first
        const cached = await cache_1.default.getAsync(cacheKey);
        if (cached) {
            res.json({ success: true, data: cached });
            return;
        }
        const symbolsToFetch = finnhubService_1.TRENDING_SYMBOLS.slice(0, limitResult.value);
        const results = await (0, finnhubService_1.processBatchedRequests)(symbolsToFetch.map(s => () => (0, finnhubService_1.getOptimizedStockData)(s)));
        const validStocks = results.filter((s) => s !== null);
        if (validStocks.length > 0) {
            await cache_1.default.setAsync(cacheKey, validStocks, finnhubService_1.CACHE_DURATIONS.TRENDING);
            res.json({ success: true, data: validStocks });
        }
        else {
            throw new Error('No trending stocks data available');
        }
    }
    catch (error) {
        logger_1.default.error('Failed to fetch trending stocks', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ success: false, error: 'Failed to fetch trending stocks' });
    }
}
async function searchStocksHandler(req, res, next) {
    var _a;
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({ success: false, error: 'Search query is required' });
            return;
        }
        if (q.length < 1 || q.length > 50) {
            res.status(400).json({ success: false, error: 'Search query must be between 1 and 50 characters' });
            return;
        }
        const sanitizedQuery = sanitizeSearchQuery(q);
        if (!sanitizedQuery.length) {
            res.status(400).json({ success: false, error: 'Invalid search query format' });
            return;
        }
        const limitResult = parseLimit(req.query.limit, finnhubService_1.LIMITS.DEFAULT_SEARCH, 1, finnhubService_1.LIMITS.MAX_SEARCH);
        if (!limitResult.valid) {
            res.status(400).json({ success: false, error: limitResult.error });
            return;
        }
        const searchResult = await (0, finnhubService_1.searchSymbols)(sanitizedQuery);
        if (((_a = searchResult === null || searchResult === void 0 ? void 0 : searchResult.result) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            const usStocks = searchResult.result.filter(item => item.type === 'Common Stock' && !item.symbol.includes('.')).slice(0, limitResult.value);
            if (usStocks.length > 0) {
                const results = await (0, finnhubService_1.processBatchedRequests)(usStocks.map(stock => () => (0, finnhubService_1.getOptimizedStockData)(stock.symbol).catch(() => (0, finnhubService_1.createEmptyStockData)(stock.symbol, stock.description))));
                const validResults = results.filter(s => s && s.price > 0);
                res.json({ success: true, data: validResults });
                return;
            }
        }
        // Return empty array for no results - this is a valid outcome, not an error
        res.json({ success: true, data: [] });
    }
    catch (error) {
        logger_1.default.error('Stock search failed', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ success: false, error: 'Stock search failed' });
    }
}
async function getStockData(req, res, next) {
    try {
        const { symbol } = req.params;
        if (!symbol || !finnhubService_1.STOCK_SYMBOL_PATTERN.test(symbol.toUpperCase())) {
            res.status(400).json({ success: false, error: 'Invalid stock symbol format' });
            return;
        }
        const stock = await (0, finnhubService_1.getFullStockData)(symbol.toUpperCase(), true);
        res.json({ success: true, data: stock });
    }
    catch (error) {
        logger_1.default.error('Failed to fetch stock data', { symbol: req.params.symbol, error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ success: false, error: `Failed to fetch data for ${req.params.symbol}` });
    }
}
async function getUserPortfolio(req, res, next) {
    var _a;
    // userId is derived from authenticated user's token - prevents IDOR vulnerabilities
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
    try {
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized: User ID missing' });
            return;
        }
        const cacheKey = buildPortfolioCacheKey(userId);
        // Try distributed cache first with short TTL for portfolio
        const cachedPortfolio = await cache_1.default.getAsync(cacheKey);
        if (cachedPortfolio) {
            logSecurityEvent(req, 'PORTFOLIO_ACCESS_SUCCESS', { userId, cached: true });
            res.json(cachedPortfolio);
            return;
        }
        logSecurityEvent(req, 'PORTFOLIO_ACCESS_SUCCESS', { userId, cached: false });
        const portfolio = await calculateUserPortfolioFromFirebase(userId);
        const result = { success: true, data: portfolio };
        // Cache portfolio for short duration (prices update frequently)
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.PORTFOLIO);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to fetch user portfolio', { userId, error: error instanceof Error ? error.message : 'Unknown' });
        logSecurityEvent(req, 'PORTFOLIO_ACCESS_FAILED', { userId, error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ success: false, error: 'Failed to fetch user portfolio' });
    }
}
async function executeTransaction(req, res, next) {
    var _a;
    try {
        const { symbol, type, amount, price } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        if (!symbol || !type || !amount || !price) {
            res.status(400).json({ success: false, error: 'Missing required fields: symbol, type, amount, price' });
            return;
        }
        if (type !== 'buy' && type !== 'sell') {
            res.status(400).json({ success: false, error: 'Transaction type must be buy or sell' });
            return;
        }
        const numericAmount = parseFloat(amount), numericPrice = parseFloat(price);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            res.status(400).json({ success: false, error: 'Amount must be a positive number' });
            return;
        }
        if (isNaN(numericPrice) || numericPrice <= 0) {
            res.status(400).json({ success: false, error: 'Price must be a positive number' });
            return;
        }
        const shares = Math.floor(numericAmount / numericPrice * 100) / 100;
        if (shares <= 0) {
            res.status(400).json({ success: false, error: 'Transaction amount is too small to purchase any shares' });
            return;
        }
        let sanitizedSymbol;
        try {
            sanitizedSymbol = sanitizeStockSymbol(symbol);
        }
        catch (e) {
            res.status(400).json({ success: false, error: e instanceof Error ? e.message : 'Invalid symbol' });
            return;
        }
        const now = firestore_1.Timestamp.now();
        const nowISO = new Date().toISOString();
        if (type === 'sell') {
            // Use Firestore transaction to prevent TOCTOU race condition
            // This ensures atomic check-and-write to prevent overselling
            if (!firebase_1.db)
                throw new Error('Firestore not initialized');
            await firebase_1.db.runTransaction(async (transaction) => {
                const portfolio = await calculateUserPortfolioFromFirebase(userId);
                const holding = portfolio.find(s => s.symbol === sanitizedSymbol);
                if (!holding)
                    throw new Error(`Cannot sell ${sanitizedSymbol} - you don't own any shares`);
                if (holding.shares < shares)
                    throw new Error(`Cannot sell ${shares} shares of ${sanitizedSymbol} - you only own ${holding.shares} shares`);
                const txRef = firebase_1.db.collection('stockTransactions').doc();
                transaction.set(txRef, {
                    userId, symbol: sanitizedSymbol, transactionType: type, shares,
                    pricePerShare: numericPrice, totalAmount: shares * numericPrice,
                    transactionDate: nowISO, createdAt: nowISO, timestamp: now
                });
            });
        }
        else {
            await saveTransactionToFirebase({
                userId, symbol: sanitizedSymbol, transactionType: type, shares,
                pricePerShare: numericPrice, totalAmount: shares * numericPrice,
                transactionDate: nowISO, createdAt: nowISO
            });
        }
        // Invalidate portfolio and transaction history caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`portfolio:${userId}*`),
            cache_1.default.invalidatePatternAsync(`transactions:${userId}:*`)
        ]);
        logSecurityEvent(req, 'TRANSACTION_EXECUTED', { symbol: sanitizedSymbol, type, amount: numericAmount, shares, price: numericPrice });
        res.json({
            success: true,
            message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${shares} shares of ${sanitizedSymbol}`,
            data: { symbol: sanitizedSymbol, type, shares, price: numericPrice, totalValue: shares * numericPrice }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error('Transaction failed', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        // Return validation errors with 400 status, server errors with 500
        if (errorMessage.includes('don\'t own') || errorMessage.includes('only own') || errorMessage.includes('Invalid')) {
            res.status(400).json({ success: false, error: errorMessage });
        }
        else {
            res.status(500).json({ success: false, error: 'Transaction failed' });
        }
    }
}
async function getMaxSellAmount(req, res, next) {
    var _a;
    try {
        const { symbol } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        if (!symbol) {
            res.status(400).json({ success: false, error: 'Stock symbol is required' });
            return;
        }
        let sanitizedSymbol;
        try {
            sanitizedSymbol = sanitizeStockSymbol(symbol);
        }
        catch (e) {
            res.status(400).json({ success: false, error: e instanceof Error ? e.message : 'Invalid symbol' });
            return;
        }
        const portfolio = await calculateUserPortfolioFromFirebase(userId);
        const holding = portfolio.find(s => s.symbol === sanitizedSymbol);
        if (!holding) {
            res.json({ success: true, data: { shares: 0, value: 0, price: 0 } });
            return;
        }
        try {
            const stockData = await (0, finnhubService_1.getFullStockData)(sanitizedSymbol, false);
            res.json({ success: true, data: { shares: holding.shares, value: holding.shares * stockData.price, price: stockData.price } });
        }
        catch {
            res.json({ success: true, data: { shares: holding.shares, value: holding.shares * holding.purchasePrice, price: holding.purchasePrice } });
        }
    }
    catch (error) {
        logger_1.default.error('Failed to get max sell amount', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ success: false, error: 'Failed to get maximum sell amount' });
    }
}
async function getTransactionHistory(req, res, next) {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const limitResult = parseLimit(req.query.limit, finnhubService_1.LIMITS.DEFAULT_TRANSACTION_HISTORY, 1, finnhubService_1.LIMITS.MAX_TRANSACTION_HISTORY);
        if (!limitResult.valid) {
            res.status(400).json({ success: false, error: limitResult.error });
            return;
        }
        const cacheKey = buildTransactionHistoryCacheKey(userId, limitResult.value);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        if (!firebase_1.db)
            throw new Error('Firestore not initialized');
        const snapshot = await firebase_1.db.collection('stockTransactions')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(limitResult.value)
            .get();
        // Normalize all timestamps to ISO strings for consistent client-side parsing
        const transactions = snapshot.docs.map(doc => {
            const data = doc.data();
            let timestamp = null;
            // Handle Firestore Timestamp, Date, or string timestamps
            // Priority: timestamp field > createdAt > transactionDate
            const timestampField = data.timestamp || data.createdAt || data.transactionDate;
            if (timestampField) {
                if (typeof timestampField.toDate === 'function') {
                    // Firestore Timestamp
                    timestamp = timestampField.toDate().toISOString();
                }
                else if (timestampField instanceof Date) {
                    timestamp = timestampField.toISOString();
                }
                else if (typeof timestampField === 'string') {
                    // Validate and pass through valid ISO strings
                    const parsed = new Date(timestampField);
                    timestamp = isNaN(parsed.getTime()) ? null : parsed.toISOString();
                }
            }
            return { id: doc.id, ...data, timestamp };
        });
        const result = { success: true, data: transactions };
        // Cache transaction history
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to get transaction history', { error: error instanceof Error ? error.message : 'Unknown' });
        res.status(500).json({ success: false, error: 'Failed to get transaction history' });
    }
}
// ============================================================================
// Watchlist Management
// ============================================================================
/**
 * Build cache key for user watchlist
 */
function buildWatchlistCacheKey(userId) {
    return `watchlist:${userId}`;
}
/**
 * Get user's watchlist
 */
async function getUserWatchlist(req, res, next) {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const cacheKey = buildWatchlistCacheKey(userId);
        // Try distributed cache first
        const cachedWatchlist = await cache_1.default.getAsync(cacheKey);
        if (cachedWatchlist) {
            res.json({ success: true, data: { symbols: cachedWatchlist.symbols || [] } });
            return;
        }
        if (!firebase_1.db)
            throw new Error('Firestore not initialized');
        // Fetch watchlist from Firestore
        const watchlistDoc = await firebase_1.db.collection('watchlists').doc(userId).get();
        let symbols = [];
        if (watchlistDoc.exists) {
            const data = watchlistDoc.data();
            symbols = ((data === null || data === void 0 ? void 0 : data.symbols) || []);
        }
        else {
            // Create empty watchlist document for new users
            await firebase_1.db.collection('watchlists').doc(userId).set({ symbols: [], updatedAt: new Date().toISOString() });
        }
        const result = { success: true, data: { symbols } };
        // Cache watchlist (cache with the structure that matches response)
        await cache_1.default.setAsync(cacheKey, { symbols }, cache_1.CACHE_TTL.LIST_QUERY);
        res.json(result);
    }
    catch (error) {
        logger_1.default.error('Failed to get user watchlist', {
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid,
            error: error instanceof Error ? error.message : 'Unknown'
        });
        res.status(500).json({ success: false, error: 'Failed to get user watchlist' });
    }
}
/**
 * Add symbol to watchlist
 */
async function addToWatchlist(req, res, next) {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const { symbol } = req.body;
        if (!symbol || typeof symbol !== 'string') {
            res.status(400).json({ success: false, error: 'Symbol is required' });
            return;
        }
        let sanitizedSymbol;
        try {
            sanitizedSymbol = sanitizeStockSymbol(symbol);
        }
        catch (e) {
            res.status(400).json({
                success: false,
                error: e instanceof Error ? e.message : 'Invalid symbol'
            });
            return;
        }
        if (!firebase_1.db)
            throw new Error('Firestore not initialized');
        // Use Firestore transaction to ensure atomic update
        await firebase_1.db.runTransaction(async (transaction) => {
            const watchlistRef = firebase_1.db.collection('watchlists').doc(userId);
            const watchlistDoc = await transaction.get(watchlistRef);
            let symbols = [];
            if (watchlistDoc.exists) {
                const data = watchlistDoc.data();
                symbols = ((data === null || data === void 0 ? void 0 : data.symbols) || []);
            }
            // Only add if not already in watchlist
            if (!symbols.includes(sanitizedSymbol)) {
                symbols.push(sanitizedSymbol);
                transaction.set(watchlistRef, {
                    symbols,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
        });
        // Invalidate cache
        await cache_1.default.delAsync(buildWatchlistCacheKey(userId));
        logSecurityEvent(req, 'WATCHLIST_UPDATED', { userId, action: 'add', symbol: sanitizedSymbol });
        res.json({ success: true, message: `Added ${sanitizedSymbol} to watchlist` });
    }
    catch (error) {
        logger_1.default.error('Failed to add to watchlist', {
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid,
            error: error instanceof Error ? error.message : 'Unknown'
        });
        res.status(500).json({ success: false, error: 'Failed to add to watchlist' });
    }
}
/**
 * Remove symbol from watchlist
 */
async function removeFromWatchlist(req, res, next) {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const { symbol } = req.params;
        if (!symbol) {
            res.status(400).json({ success: false, error: 'Symbol is required' });
            return;
        }
        let sanitizedSymbol;
        try {
            sanitizedSymbol = sanitizeStockSymbol(symbol);
        }
        catch (e) {
            res.status(400).json({
                success: false,
                error: e instanceof Error ? e.message : 'Invalid symbol'
            });
            return;
        }
        if (!firebase_1.db)
            throw new Error('Firestore not initialized');
        // Use Firestore transaction to ensure atomic update
        await firebase_1.db.runTransaction(async (transaction) => {
            const watchlistRef = firebase_1.db.collection('watchlists').doc(userId);
            const watchlistDoc = await transaction.get(watchlistRef);
            if (!watchlistDoc.exists) {
                return; // Nothing to remove
            }
            const data = watchlistDoc.data();
            const symbols = ((data === null || data === void 0 ? void 0 : data.symbols) || []).filter(s => s !== sanitizedSymbol);
            transaction.set(watchlistRef, {
                symbols,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        });
        // Invalidate cache
        await cache_1.default.delAsync(buildWatchlistCacheKey(userId));
        logSecurityEvent(req, 'WATCHLIST_UPDATED', { userId, action: 'remove', symbol: sanitizedSymbol });
        res.json({ success: true, message: `Removed ${sanitizedSymbol} from watchlist` });
    }
    catch (error) {
        logger_1.default.error('Failed to remove from watchlist', {
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid,
            error: error instanceof Error ? error.message : 'Unknown'
        });
        res.status(500).json({ success: false, error: 'Failed to remove from watchlist' });
    }
}
/**
 * Update entire watchlist
 */
async function updateWatchlist(req, res, next) {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            res.status(401).json({ success: false, error: 'Authentication required' });
            return;
        }
        const { symbols } = req.body;
        if (!Array.isArray(symbols)) {
            res.status(400).json({ success: false, error: 'Symbols must be an array' });
            return;
        }
        // Validate and sanitize all symbols
        const sanitizedSymbols = [];
        for (const symbol of symbols) {
            try {
                sanitizedSymbols.push(sanitizeStockSymbol(symbol));
            }
            catch (e) {
                res.status(400).json({
                    success: false,
                    error: `Invalid symbol: ${symbol}. ${e instanceof Error ? e.message : 'Invalid format'}`
                });
                return;
            }
        }
        // Remove duplicates
        const uniqueSymbols = [...new Set(sanitizedSymbols)];
        if (!firebase_1.db)
            throw new Error('Firestore not initialized');
        // Update watchlist
        await firebase_1.db.collection('watchlists').doc(userId).set({
            symbols: uniqueSymbols,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        // Invalidate cache
        await cache_1.default.delAsync(buildWatchlistCacheKey(userId));
        logSecurityEvent(req, 'WATCHLIST_UPDATED', { userId, action: 'update', count: uniqueSymbols.length });
        res.json({ success: true, message: 'Watchlist updated successfully' });
    }
    catch (error) {
        logger_1.default.error('Failed to update watchlist', {
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid,
            error: error instanceof Error ? error.message : 'Unknown'
        });
        res.status(500).json({ success: false, error: 'Failed to update watchlist' });
    }
}
// ============================================================================
// Export
// ============================================================================
exports.default = {
    getMarketIndices,
    getTrendingStocks,
    searchStocks: searchStocksHandler,
    getStockData,
    getUserPortfolio,
    executeTransaction,
    getMaxSellAmount,
    getTransactionHistory,
    getUserWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateWatchlist
};
