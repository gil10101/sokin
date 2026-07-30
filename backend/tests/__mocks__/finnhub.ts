/**
 * Finnhub API Mock
 * 
 * Mocks Finnhub API responses for testing stock-related functionality
 * without requiring actual API calls or credentials.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const jest: any;

// Sample stock quote response
export const mockQuote = {
  c: 175.50,  // Current price
  h: 177.25,  // High price of the day
  l: 174.00,  // Low price of the day
  o: 175.00,  // Open price
  pc: 173.25, // Previous close
  t: Math.floor(Date.now() / 1000), // Timestamp
};

// Sample company profile response
export const mockProfile = {
  name: 'Apple Inc.',
  ticker: 'AAPL',
  marketCapitalization: 2800000,
  finnhubIndustry: 'Technology',
  weburl: 'https://www.apple.com',
  logo: 'https://static.finnhub.io/logo/aapl.png',
  phone: '408-996-1010',
  exchange: 'NASDAQ',
  ipo: '1980-12-12',
  country: 'US',
  currency: 'USD',
};

// Sample candle (historical) data response
export const mockCandles = {
  o: [174.0, 175.5, 176.2, 175.8, 174.5], // Open prices
  h: [176.5, 177.0, 178.2, 177.5, 176.0], // High prices
  l: [173.5, 174.8, 175.0, 174.2, 173.0], // Low prices
  c: [175.5, 176.0, 177.5, 175.0, 175.5], // Close prices
  v: [45000000, 42000000, 48000000, 39000000, 44000000], // Volume
  t: [1700000000, 1700086400, 1700172800, 1700259200, 1700345600], // Timestamps
  s: 'ok', // Status
};

// Sample symbol search response
export const mockSymbolSearch = {
  count: 3,
  result: [
    {
      description: 'Apple Inc.',
      displaySymbol: 'AAPL',
      symbol: 'AAPL',
      type: 'Common Stock',
    },
    {
      description: 'Apple Hospitality REIT Inc.',
      displaySymbol: 'APLE',
      symbol: 'APLE',
      type: 'Common Stock',
    },
    {
      description: 'Appleseed Fund Investor Shares',
      displaySymbol: 'APPLX',
      symbol: 'APPLX',
      type: 'Mutual Fund',
    },
  ],
};

// Market indices mock data (using ETF equivalents)
export const mockMarketIndices = {
  SPY: {
    c: 450.25,
    h: 452.00,
    l: 448.50,
    o: 449.00,
    pc: 448.00,
    t: Math.floor(Date.now() / 1000),
  },
  DIA: {
    c: 350.75,
    h: 352.00,
    l: 349.25,
    o: 350.00,
    pc: 349.50,
    t: Math.floor(Date.now() / 1000),
  },
  QQQ: {
    c: 380.50,
    h: 382.25,
    l: 378.00,
    o: 379.00,
    pc: 377.50,
    t: Math.floor(Date.now() / 1000),
  },
};

// Trending stocks mock data
export const mockTrendingStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 175.50, change: 2.25, changePercent: 1.30 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 378.25, change: 4.50, changePercent: 1.20 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 138.75, change: -1.25, changePercent: -0.89 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.50, change: 3.75, changePercent: 2.15 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 238.00, change: -5.50, changePercent: -2.26 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 485.25, change: 12.50, changePercent: 2.64 },
  { symbol: 'META', name: 'Meta Platforms Inc.', price: 325.75, change: 6.25, changePercent: 1.96 },
  { symbol: 'NFLX', name: 'Netflix Inc.', price: 485.00, change: 8.75, changePercent: 1.84 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 118.50, change: 2.00, changePercent: 1.72 },
  { symbol: 'ORCL', name: 'Oracle Corporation', price: 118.25, change: 1.50, changePercent: 1.29 },
];

// Mock Finnhub API call function
export const mockFinnhubCall = jest.fn().mockImplementation((endpoint: string) => {
  // Parse the endpoint to determine what data to return
  if (endpoint.includes('/quote')) {
    const symbolMatch = endpoint.match(/symbol=([A-Z]+)/);
    const symbol = symbolMatch ? symbolMatch[1] : 'AAPL';
    
    if (symbol in mockMarketIndices) {
      return Promise.resolve(mockMarketIndices[symbol as keyof typeof mockMarketIndices]);
    }
    return Promise.resolve(mockQuote);
  }
  
  if (endpoint.includes('/stock/profile2')) {
    return Promise.resolve(mockProfile);
  }
  
  if (endpoint.includes('/stock/candle')) {
    return Promise.resolve(mockCandles);
  }
  
  if (endpoint.includes('/search')) {
    return Promise.resolve(mockSymbolSearch);
  }
  
  return Promise.reject(new Error('Unknown endpoint'));
});

// Helper to create custom quote mock
export const createQuoteMock = (overrides: Partial<typeof mockQuote> = {}) => ({
  ...mockQuote,
  ...overrides,
});

// Helper to create custom profile mock
export const createProfileMock = (overrides: Partial<typeof mockProfile> = {}) => ({
  ...mockProfile,
  ...overrides,
});

// Helper to create custom candles mock
export const createCandlesMock = (days: number = 5) => {
  const timestamps: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];
  
  let basePrice = 175;
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = days - 1; i >= 0; i--) {
    const dayOffset = i * 86400;
    timestamps.push(now - dayOffset);
    
    const change = (Math.random() - 0.5) * 5;
    opens.push(basePrice);
    highs.push(basePrice + Math.abs(change) + 1);
    lows.push(basePrice - Math.abs(change) - 1);
    closes.push(basePrice + change);
    volumes.push(Math.floor(40000000 + Math.random() * 20000000));
    
    basePrice += change;
  }
  
  return {
    o: opens,
    h: highs,
    l: lows,
    c: closes,
    v: volumes,
    t: timestamps,
    s: 'ok',
  };
};

// Reset all mocks
export const resetFinnhubMocks = () => {
  mockFinnhubCall.mockClear();
};

export default {
  mockQuote,
  mockProfile,
  mockCandles,
  mockSymbolSearch,
  mockMarketIndices,
  mockTrendingStocks,
  mockFinnhubCall,
  createQuoteMock,
  createProfileMock,
  createCandlesMock,
  resetFinnhubMocks,
};


