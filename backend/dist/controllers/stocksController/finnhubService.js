"use strict";
/**
 * Finnhub Service
 *
 * Handles all Finnhub API communication, caching, and data transformation.
 *
 * @module controllers/stocksController/finnhubService
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIMITS = exports.TRADITIONAL_SYMBOL_MAPPING = exports.INDEX_NAME_MAPPING = exports.MARKET_INDEX_SYMBOLS = exports.TRENDING_SYMBOLS = exports.STOCK_SYMBOL_PATTERN = exports.CACHE_DURATIONS = void 0;
exports.processBatchedRequests = processBatchedRequests;
exports.convertQuoteToMarketIndex = convertQuoteToMarketIndex;
exports.createEmptyStockData = createEmptyStockData;
exports.getOptimizedStockData = getOptimizedStockData;
exports.getFullStockData = getFullStockData;
exports.getMarketIndexQuote = getMarketIndexQuote;
exports.searchSymbols = searchSymbols;
const https_1 = __importDefault(require("https"));
const cache_1 = __importDefault(require("../../utils/cache"));
const logger_1 = __importDefault(require("../../utils/logger"));
// ============================================================================
// Configuration
// ============================================================================
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
exports.CACHE_DURATIONS = {
    QUOTE: 30,
    PROFILE: 3600,
    SEARCH: 300,
    TRENDING: 60,
    MARKET_INDICES: 30,
    CANDLES: 300,
};
const REQUEST_BATCH_SIZE = 5;
exports.STOCK_SYMBOL_PATTERN = /^[A-Z0-9.^]{1,10}$/;
exports.TRENDING_SYMBOLS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'ORCL',
    'BABA', 'V', 'MA', 'JPM', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'DIS'
];
exports.MARKET_INDEX_SYMBOLS = ['SPY', 'DIA', 'QQQ'];
exports.INDEX_NAME_MAPPING = {
    'SPY': 'S&P 500',
    'DIA': 'Dow Jones Industrial Average',
    'QQQ': 'NASDAQ-100'
};
exports.TRADITIONAL_SYMBOL_MAPPING = {
    'SPY': '^GSPC',
    'DIA': '^DJI',
    'QQQ': '^IXIC'
};
exports.LIMITS = {
    MAX_TRENDING: 50,
    DEFAULT_TRENDING: 10,
    MAX_SEARCH: 25,
    DEFAULT_SEARCH: 10,
    MAX_TRANSACTION_HISTORY: 100,
    DEFAULT_TRANSACTION_HISTORY: 50,
};
// ============================================================================
// API Client
// ============================================================================
function validateFinnhubConfig() {
    if (!FINNHUB_API_KEY) {
        throw new Error('FINNHUB_API_KEY environment variable is not configured');
    }
}
async function callFinnhubAPI(endpoint, cacheDuration) {
    validateFinnhubConfig();
    const cacheKey = `finnhub:${endpoint}`;
    const cachedData = cache_1.default.get(cacheKey);
    if (cachedData)
        return cachedData;
    return new Promise((resolve, reject) => {
        // Use header-based authentication to avoid exposing API key in URL/logs
        const url = `${FINNHUB_BASE_URL}${endpoint}`;
        const request = https_1.default.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Sokin-Backend/1.0',
                'X-Finnhub-Token': FINNHUB_API_KEY
            },
            timeout: 10000,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Finnhub API error: ${res.statusCode} - ${res.statusMessage}`));
                        return;
                    }
                    const jsonData = JSON.parse(data);
                    if (jsonData.error) {
                        reject(new Error(`Finnhub API error: ${jsonData.error}`));
                        return;
                    }
                    if (cacheDuration)
                        cache_1.default.set(cacheKey, jsonData, cacheDuration);
                    resolve(jsonData);
                }
                catch (error) {
                    reject(new Error(`Invalid response from Finnhub API: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            });
        });
        request.on('error', (error) => reject(new Error(`Finnhub API unavailable: ${error.message}`)));
        request.on('timeout', () => { request.destroy(); reject(new Error('Finnhub API timeout')); });
    });
}
async function processBatchedRequests(requests, batchSize = REQUEST_BATCH_SIZE) {
    const results = [];
    for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch.map(request => request()));
        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            }
            else {
                // Log rejected promises to aid debugging while preserving graceful degradation
                logger_1.default.warn('Batch request failed', {
                    error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
                    batchIndex: i
                });
            }
        }
        if (i + batchSize < requests.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return results;
}
// ============================================================================
// Data Transformers
// ============================================================================
/**
 * Format market cap from millions to human-readable string
 * Finnhub returns marketCapitalization in millions
 */
function formatMarketCap(marketCapInMillions) {
    if (!marketCapInMillions || marketCapInMillions <= 0)
        return 'N/A';
    const cap = marketCapInMillions * 1000000; // Convert from millions to actual value
    if (cap >= 1000000000000) {
        return `${(cap / 1000000000000).toFixed(2)}T`;
    }
    else if (cap >= 1000000000) {
        return `${(cap / 1000000000).toFixed(2)}B`;
    }
    else if (cap >= 1000000) {
        return `${(cap / 1000000).toFixed(2)}M`;
    }
    return `${cap.toLocaleString()}`;
}
function convertFinnhubToStockData(symbol, quote, profile, candles) {
    const change = quote.c - quote.pc;
    const changePercent = quote.pc !== 0 ? (change / quote.pc) * 100 : 0;
    let weekHigh52 = quote.h, weekLow52 = quote.l, volume = 0, avgVolume = 0, weekChange52 = 0, chart = [];
    if (candles && candles.s === 'ok' && candles.c.length > 0) {
        weekHigh52 = Math.max(...candles.h);
        weekLow52 = Math.min(...candles.l);
        volume = candles.v[candles.v.length - 1] || 0;
        avgVolume = candles.v.reduce((sum, v) => sum + v, 0) / candles.v.length;
        const yearAgoPrice = candles.c[0];
        if (yearAgoPrice && yearAgoPrice > 0)
            weekChange52 = ((quote.c - yearAgoPrice) / yearAgoPrice) * 100;
        chart = candles.c.slice(-30);
    }
    return {
        symbol: symbol.toUpperCase(),
        name: (profile === null || profile === void 0 ? void 0 : profile.name) || symbol.toUpperCase(),
        price: Number(quote.c.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume,
        avgVolume: Math.round(avgVolume),
        marketCap: formatMarketCap(profile === null || profile === void 0 ? void 0 : profile.marketCapitalization),
        peRatio: null,
        weekHigh52: Number(weekHigh52.toFixed(2)),
        weekLow52: Number(weekLow52.toFixed(2)),
        weekChange52: Number(weekChange52.toFixed(2)),
        chart
    };
}
function convertQuoteToMarketIndex(quote, displayName, traditionalSymbol) {
    const change = quote.c - quote.pc;
    const changePercent = quote.pc !== 0 ? (change / quote.pc) * 100 : 0;
    return {
        symbol: traditionalSymbol,
        name: displayName,
        price: Number(quote.c.toFixed(2)),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2))
    };
}
function createEmptyStockData(symbol, name) {
    return {
        symbol: symbol.toUpperCase(),
        name: name || symbol.toUpperCase(),
        price: 0, change: 0, changePercent: 0, volume: 0, avgVolume: 0,
        marketCap: 'N/A', peRatio: null, weekHigh52: 0, weekLow52: 0, weekChange52: 0, chart: []
    };
}
// ============================================================================
// Stock Data Service
// ============================================================================
async function getOptimizedStockData(symbol) {
    try {
        // URL encode symbol to handle special characters (e.g., BRK.A, BRK.B)
        const encodedSymbol = encodeURIComponent(symbol);
        const [quote, profile] = await Promise.allSettled([
            callFinnhubAPI(`/quote?symbol=${encodedSymbol}`, exports.CACHE_DURATIONS.QUOTE),
            callFinnhubAPI(`/stock/profile2?symbol=${encodedSymbol}`, exports.CACHE_DURATIONS.PROFILE)
        ]);
        if (quote.status === 'fulfilled' && quote.value && quote.value.c > 0) {
            const profileData = profile.status === 'fulfilled' ? profile.value : undefined;
            return convertFinnhubToStockData(symbol, quote.value, profileData);
        }
        return null;
    }
    catch (error) {
        // Log errors at debug level for troubleshooting while maintaining graceful degradation
        logger_1.default.debug('Failed to fetch optimized stock data', {
            symbol,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}
async function getFullStockData(symbol, includeHistorical = true) {
    // URL encode symbol to handle special characters (e.g., BRK.A, BRK.B)
    const encodedSymbol = encodeURIComponent(symbol);
    const [quote, profile] = await Promise.allSettled([
        callFinnhubAPI(`/quote?symbol=${encodedSymbol}`, exports.CACHE_DURATIONS.QUOTE),
        callFinnhubAPI(`/stock/profile2?symbol=${encodedSymbol}`, exports.CACHE_DURATIONS.PROFILE)
    ]);
    if (quote.status === 'fulfilled' && quote.value && quote.value.c > 0) {
        let candles;
        if (includeHistorical) {
            try {
                const toTimestamp = Math.floor(Date.now() / 1000);
                const fromTimestamp = toTimestamp - (365 * 24 * 60 * 60);
                const candleResult = await callFinnhubAPI(`/stock/candle?symbol=${encodedSymbol}&resolution=D&from=${fromTimestamp}&to=${toTimestamp}`, exports.CACHE_DURATIONS.CANDLES);
                if (candleResult.s === 'ok')
                    candles = candleResult;
            }
            catch (e) {
                logger_1.default.debug('Failed to fetch candle data', { symbol, error: e instanceof Error ? e.message : 'Unknown' });
            }
        }
        const profileData = profile.status === 'fulfilled' ? profile.value : undefined;
        return convertFinnhubToStockData(symbol, quote.value, profileData, candles);
    }
    throw new Error(`Failed to fetch stock data for ${symbol} from Finnhub API`);
}
async function getMarketIndexQuote(symbol) {
    try {
        // URL encode symbol to handle special characters
        const quote = await callFinnhubAPI(`/quote?symbol=${encodeURIComponent(symbol)}`, exports.CACHE_DURATIONS.MARKET_INDICES);
        return quote.c > 0 ? quote : null;
    }
    catch {
        return null;
    }
}
async function searchSymbols(query) {
    return callFinnhubAPI(`/search?q=${encodeURIComponent(query)}`, exports.CACHE_DURATIONS.SEARCH);
}
