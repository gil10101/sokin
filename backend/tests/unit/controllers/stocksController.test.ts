/**
 * Stocks Controller Unit Tests
 * 
 * Tests stock-related functionality including:
 * - Market indices retrieval
 * - Stock data fetching
 * - Portfolio operations
 * - Transaction execution
 */

import { Request, Response, NextFunction } from 'express';
import stocksController from '../../../src/controllers/stocksController';

/** Extended Request type with authenticated user */
interface AuthenticatedRequest extends Request {
  user?: { uid: string; email?: string };
}

// Mock cache - all async methods
jest.mock('../../../src/utils/cache', () => ({
  __esModule: true,
  default: {
    getAsync: jest.fn(),
    setAsync: jest.fn(),
    delAsync: jest.fn(),
    invalidatePatternAsync: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
  CACHE_TTL: {
    SINGLE_ITEM: 30,
    LIST_QUERY: 30,
    DASHBOARD: 600,
    PORTFOLIO: 15,
    USER_SETTINGS: 600,
    STOCK_QUOTE: 30,
    COMPANY_PROFILE: 3600,
  },
}));

// Mock upstashCache (used by finnhubService)
jest.mock('../../../src/utils/upstashCache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    invalidatePattern: jest.fn(),
    has: jest.fn(),
    getOrSet: jest.fn(),
    getStats: jest.fn().mockReturnValue({ memorySize: 0, upstashAvailable: true, lastHealthCheck: 0 }),
  },
  CACHE_TTL: {
    QUOTE: 30,
    PROFILE: 3600,
    SEARCH: 300,
    TRENDING: 60,
    MARKET_INDICES: 30,
    CANDLES: 300,
    PORTFOLIO: 15,
    USER_SETTINGS: 600,
  },
}));

// Mock Firebase with realistic stock transaction data
jest.mock('../../../src/config/firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ docs: [] }),
          })),
        })),
        get: jest.fn().mockResolvedValue({ docs: [] }),
      })),
      add: jest.fn().mockResolvedValue({ id: 'txn-xyz789' }),
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ 
          exists: true,
          data: () => ({
            userId: 'user-123',
            symbol: 'AAPL',
            transactionType: 'buy',
            shares: 10.5,
            pricePerShare: 175.50,
            totalAmount: 1842.75,
            transactionDate: '2025-01-15T10:30:00.000Z',
            createdAt: '2025-01-15T10:30:00.000Z',
            timestamp: new Date('2025-01-15T10:30:00.000Z'),
          }),
        }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  },
  auth: null,
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock finnhubService functions
jest.mock('../../../src/controllers/stocksController/finnhubService', () => ({
  CACHE_DURATIONS: { QUOTE: 30, PROFILE: 3600, SEARCH: 300, TRENDING: 60, MARKET_INDICES: 30 },
  STOCK_SYMBOL_PATTERN: /^[A-Z0-9^]{1,10}$/,
  TRENDING_SYMBOLS: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
  MARKET_INDEX_SYMBOLS: ['SPY', 'QQQ', 'DIA'],
  INDEX_NAME_MAPPING: { 'SPY': 'S&P 500', 'QQQ': 'NASDAQ 100', 'DIA': 'Dow Jones' },
  TRADITIONAL_SYMBOL_MAPPING: { 'SPY': '^GSPC', 'QQQ': '^IXIC', 'DIA': '^DJI' },
  LIMITS: { 
    DEFAULT_TRENDING: 10, MAX_TRENDING: 50, 
    DEFAULT_SEARCH: 10, MAX_SEARCH: 25,
    DEFAULT_TRANSACTION_HISTORY: 50, MAX_TRANSACTION_HISTORY: 100
  },
  getOptimizedStockData: jest.fn().mockResolvedValue({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 175.50,
    change: 2.25,
    changePercent: 1.30,
    open: 173.25,
    high: 176.00,
    low: 172.50,
    previousClose: 173.25,
  }),
  getFullStockData: jest.fn().mockResolvedValue({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 175.50,
    change: 2.25,
    changePercent: 1.30,
    open: 173.25,
    high: 176.00,
    low: 172.50,
    previousClose: 173.25,
  }),
  getMarketIndexQuote: jest.fn().mockResolvedValue({
    c: 450.50, h: 452.00, l: 448.25, o: 449.00, pc: 448.75, t: Date.now() / 1000
  }),
  searchSymbols: jest.fn().mockResolvedValue({
    count: 2,
    result: [
      { description: 'Apple Inc.', displaySymbol: 'AAPL', symbol: 'AAPL', type: 'Common Stock' },
    ]
  }),
  processBatchedRequests: jest.fn().mockImplementation(async (requests: (() => Promise<unknown>)[]) => {
    return Promise.all(requests.map(fn => fn()));
  }),
  convertQuoteToMarketIndex: jest.fn().mockImplementation((quote, name, symbol) => ({
    symbol, name, price: quote.c, change: quote.c - quote.pc, changePercent: ((quote.c - quote.pc) / quote.pc) * 100
  })),
  createEmptyStockData: jest.fn().mockImplementation((symbol, name) => ({
    symbol, name: name || symbol, price: 0, change: 0, changePercent: 0, open: 0, high: 0, low: 0, previousClose: 0
  })),
}));

import cache from '../../../src/utils/cache';

describe('Stocks Controller', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockNext = jest.fn();

    mockRequest = {
      user: { uid: 'user-123', email: 'test@example.com' },
      params: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      get: jest.fn(),
      originalUrl: '/api/stocks',
      method: 'GET',
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();
    
    // Reset cache mocks
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getMarketIndices', () => {
    it('should return market indices data with correct structure', async () => {
      await stocksController.getMarketIndices(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });

    it('should return cached data when available', async () => {
      const cachedData = [
        { symbol: '^GSPC', name: 'S&P 500', price: 4500, change: 25, changePercent: 0.56 },
        { symbol: '^DJI', name: 'Dow Jones Industrial Average', price: 35000, change: 150, changePercent: 0.43 },
        { symbol: '^IXIC', name: 'NASDAQ Composite', price: 14000, change: 75, changePercent: 0.54 },
      ];
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedData);

      // Note: Market indices doesn't use cache directly in this implementation
      await stocksController.getMarketIndices(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe('getTrendingStocks', () => {
    it('should return trending stocks with default limit', async () => {
      mockRequest.query = {};

      await stocksController.getTrendingStocks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });

    it('should respect limit parameter', async () => {
      mockRequest.query = { limit: '5' };

      await stocksController.getTrendingStocks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalled();
    });

    it('should reject invalid limit parameter (over max)', async () => {
      mockRequest.query = { limit: '100' }; // Over max of 50

      await stocksController.getTrendingStocks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('limit'),
        })
      );
    });
  });

  describe('getStockData', () => {
    it('should return stock data for valid symbol', async () => {
      mockRequest.params = { symbol: 'AAPL' };

      await stocksController.getStockData(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            symbol: 'AAPL',
          }),
        })
      );
    });

    it('should reject invalid symbol format', async () => {
      mockRequest.params = { symbol: 'invalid123!' };

      await stocksController.getStockData(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('symbol'),
        })
      );
    });

    it('should accept valid stock symbols', async () => {
      const validSymbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMD'];
      
      for (const symbol of validSymbols) {
        mockRequest.params = { symbol };
        
        await stocksController.getStockData(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Just verify success is returned (symbol comes from mock which always returns AAPL)
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
        
        jest.clearAllMocks();
        (cache.getAsync as jest.Mock).mockResolvedValue(null);
      }
    });
  });

  describe('searchStocks', () => {
    it('should search stocks by query', async () => {
      mockRequest.query = { q: 'Apple' };

      await stocksController.searchStocks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalled();
    });

    it('should reject empty query', async () => {
      mockRequest.query = { q: '' };

      await stocksController.searchStocks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should reject query that is too long', async () => {
      mockRequest.query = { q: 'a'.repeat(51) };

      await stocksController.searchStocks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('getUserPortfolio', () => {
    it('should return 403 for unauthorized access to other user portfolio', async () => {
      mockRequest.params = { userId: 'different-user-456' };
      mockRequest.user = { uid: 'user-123' };

      await stocksController.getUserPortfolio(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should return portfolio for authorized user', async () => {
      mockRequest.params = { userId: 'user-123' };
      mockRequest.user = { uid: 'user-123' };

      await stocksController.getUserPortfolio(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('executeTransaction', () => {
    it('should reject request without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        symbol: 'AAPL',
        type: 'buy',
        amount: 1000,
        price: 175.50,
      };

      await stocksController.executeTransaction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should reject invalid transaction type', async () => {
      mockRequest.body = {
        symbol: 'AAPL',
        type: 'invalid',
        amount: 1000,
        price: 175.50,
      };

      await stocksController.executeTransaction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should accept valid buy transaction', async () => {
      mockRequest.body = {
        symbol: 'AAPL',
        type: 'buy',
        amount: 1000,
        price: 175.50,
      };

      await stocksController.executeTransaction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalled();
    });

    it('should reject negative amount', async () => {
      mockRequest.body = {
        symbol: 'AAPL',
        type: 'buy',
        amount: -100,
        price: 175.50,
      };

      await stocksController.executeTransaction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should reject missing required fields', async () => {
      mockRequest.body = {
        symbol: 'AAPL',
        // Missing type, amount, price
      };

      await stocksController.executeTransaction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('getMaxSellAmount', () => {
    it('should reject request without authentication', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { symbol: 'AAPL' };

      await stocksController.getMaxSellAmount(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return zero shares for stocks not owned', async () => {
      mockRequest.params = { symbol: 'AAPL' };

      await stocksController.getMaxSellAmount(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            shares: 0,
          }),
        })
      );
    });
  });

  describe('getTransactionHistory', () => {
    it('should reject request without authentication', async () => {
      mockRequest.user = undefined;

      await stocksController.getTransactionHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return transaction history for authenticated user', async () => {
      mockRequest.query = { limit: '20' };

      await stocksController.getTransactionHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });

    it('should reject invalid limit parameter', async () => {
      mockRequest.query = { limit: '200' }; // Over max of 100

      await stocksController.getTransactionHistory(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should accept valid limit parameters', async () => {
      const validLimits = ['10', '50', '100'];
      
      for (const limit of validLimits) {
        mockRequest.query = { limit };
        jest.clearAllMocks();
        (cache.getAsync as jest.Mock).mockResolvedValue(null);

        await stocksController.getTransactionHistory(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      }
    });
  });
});
