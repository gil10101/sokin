/**
 * Jest Test Setup
 * 
 * This file is executed before each test file.
 * It sets up the test environment, mocks, and global configurations.
 */

/// <reference types="jest" />

import { Request, Response, NextFunction } from 'express';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.FINNHUB_API_KEY = 'test_finnhub_api_key';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test_token';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Increase timeout for async operations
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console.log and console.info in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsole.log;
  console.info = originalConsole.info;
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock fetch globally for API tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Helper to reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Global test utilities
 */

// Helper type for mock request overrides
interface MockRequestOverrides {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  user?: { uid: string; email?: string } | undefined;
  ip?: string;
  socket?: { remoteAddress?: string };
  get?: jest.Mock;
}

// Helper to create a mock Express request
export const createMockRequest = (overrides: MockRequestOverrides = {}): Partial<Request> => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: undefined,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    get: jest.fn(),
    ...overrides,
  } as unknown as Partial<Request>;
};

// Helper to create a mock Express response
export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  res.send = jest.fn().mockReturnValue(res) as unknown as Response['send'];
  res.set = jest.fn().mockReturnValue(res) as unknown as Response['set'];
  return res;
};

// Helper to create a mock Next function
export const createMockNext = (): jest.MockedFunction<NextFunction> => jest.fn();

// Type declarations for global test helpers
declare global {
  function createMockRequest(overrides?: MockRequestOverrides): Partial<Request>;
  function createMockResponse(): Partial<Response>;
  function createMockNext(): jest.MockedFunction<NextFunction>;
}

// Attach to global for use in tests
(global as typeof globalThis & { 
  createMockRequest: typeof createMockRequest;
  createMockResponse: typeof createMockResponse;
  createMockNext: typeof createMockNext;
}).createMockRequest = createMockRequest;

(global as typeof globalThis & { 
  createMockRequest: typeof createMockRequest;
  createMockResponse: typeof createMockResponse;
  createMockNext: typeof createMockNext;
}).createMockResponse = createMockResponse;

(global as typeof globalThis & { 
  createMockRequest: typeof createMockRequest;
  createMockResponse: typeof createMockResponse;
  createMockNext: typeof createMockNext;
}).createMockNext = createMockNext;
