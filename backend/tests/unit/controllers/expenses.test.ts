/**
 * Expenses Controller Unit Tests
 * 
 * Tests expense CRUD operations including:
 * - Input validation
 * - Authorization checks
 * - Caching behavior
 * - Database operations
 * - Error handling
 * 
 * Mock data structures match actual Firestore schema.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../../../src/controllers/expenses';

/** Extended Request type with authenticated user */
interface AuthenticatedRequest extends Request {
  user?: { uid: string; email?: string };
}

// Import mock data templates
import { 
  createMockExpense,
} from '../../__mocks__/firebase-admin';

// Mock cache - all async methods
// Important: Use jest.fn() directly in the factory to avoid hoisting issues
jest.mock('../../../src/utils/cache', () => ({
  __esModule: true,
  default: {
    getAsync: jest.fn(),
    setAsync: jest.fn(),
    delAsync: jest.fn(),
    invalidatePatternAsync: jest.fn(),
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

// Mock Firebase with realistic expense data and pagination support
jest.mock('../../../src/config/firebase', () => {
  const mockDoc = {
    exists: true,
    id: 'expense-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      name: 'Grocery Shopping',
      amount: 85.50,
      date: '2025-01-15',
      category: 'Food',
      description: 'Weekly groceries from local store',
      tags: ['groceries', 'weekly'],
      createdAt: '2025-01-15T10:30:00.000Z',
      updatedAt: '2025-01-15T10:30:00.000Z',
    })),
  };

  const mockAdd = jest.fn().mockResolvedValue({ id: 'new-expense-xyz789' });
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue(mockDoc);

  const mockQuerySnapshot = {
    docs: [mockDoc],
    empty: false,
  };

  // Chain builder for pagination queries
  interface MockQueryChain {
    where: jest.Mock;
    orderBy: jest.Mock;
    limit: jest.Mock;
    startAfter: jest.Mock;
    get: jest.Mock;
  }

  const createMockQueryChain = (): MockQueryChain => {
    const chain: MockQueryChain = {
      where: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      startAfter: jest.fn(),
      get: jest.fn().mockResolvedValue(mockQuerySnapshot),
    };
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    chain.startAfter.mockReturnValue(chain);
    return chain;
  };

  return {
    db: {
      collection: jest.fn(() => ({
        doc: jest.fn((id?: string) => ({
          get: id ? mockGet : jest.fn().mockResolvedValue(mockDoc),
          update: mockUpdate,
          delete: mockDelete,
        })),
        add: mockAdd,
        where: jest.fn(() => createMockQueryChain()),
        orderBy: jest.fn(() => createMockQueryChain()),
        limit: jest.fn(() => createMockQueryChain()),
      })),
    },
    __mocks: { mockDoc, mockAdd, mockUpdate, mockDelete, mockGet, createMockQueryChain },
  };
});

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import cache after mocking so we can access the mock functions
import cache from '../../../src/utils/cache';
const firebaseMocks = require('../../../src/config/firebase').__mocks;

describe('Expenses Controller', () => {
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
      body: {},
      query: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();

    // Reset mock doc data to default expense structure
    firebaseMocks.mockDoc.data = jest.fn(() => ({
      userId: 'user-123',
      name: 'Grocery Shopping',
      amount: 85.50,
      date: '2025-01-15',
      category: 'Food',
      description: 'Weekly groceries from local store',
      tags: ['groceries', 'weekly'],
      createdAt: '2025-01-15T10:30:00.000Z',
      updatedAt: '2025-01-15T10:30:00.000Z',
    }));
    firebaseMocks.mockDoc.exists = true;
    
    // Reset cache mocks to return null (cache miss)
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.delAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getAllExpenses', () => {
    it('should return all expenses for authenticated user with pagination', async () => {
      await getAllExpenses(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.objectContaining({
            count: expect.any(Number),
            limit: expect.any(Number),
            hasMore: expect.any(Boolean),
          }),
        })
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getAllExpenses(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should return cached expenses when available', async () => {
      const cachedResult = {
        success: true,
        data: [
          createMockExpense({ id: 'cached-1', name: 'Cached Lunch', amount: 25.00 }),
          createMockExpense({ id: 'cached-2', name: 'Cached Dinner', amount: 45.00 }),
        ],
        pagination: { count: 2, limit: 50, nextCursor: null, hasMore: false }
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

      await getAllExpenses(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(cachedResult);
      // Cache should be checked but not set (cache hit)
      expect(cache.getAsync).toHaveBeenCalled();
    });

    it('should cache expenses after fetching from database', async () => {
      await getAllExpenses(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify cache.setAsync was called with correct pattern
      expect(cache.setAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^expenses:user-123:/),
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.any(Object),
        }),
        expect.any(Number)
      );
    });

    it('should respect query parameters for pagination', async () => {
      mockRequest.query = {
        limit: '20',
        sortOrder: 'asc',
        sortBy: 'amount',
      };

      await getAllExpenses(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe('getExpenseById', () => {
    it('should return expense by ID with correct structure', async () => {
      mockRequest.params = { id: 'expense-abc123' };

      await getExpenseById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'expense-abc123',
            name: 'Grocery Shopping',
            amount: 85.50,
            category: 'Food',
          }),
        })
      );
    });

    it('should return cached expense when available', async () => {
      mockRequest.params = { id: 'expense-abc123' };
      const cachedExpense = {
        success: true,
        data: {
          id: 'expense-abc123',
          userId: 'user-123',
          name: 'Cached Expense',
          amount: 50.00,
          category: 'Food',
        }
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedExpense);

      await getExpenseById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(cachedExpense);
    });

    it('should cache expense after fetching from database', async () => {
      mockRequest.params = { id: 'expense-abc123' };

      await getExpenseById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.setAsync).toHaveBeenCalledWith(
        'expense:expense-abc123',
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        }),
        expect.any(Number)
      );
    });

    it('should call next with error for non-existent expense', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await getExpenseById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized access', async () => {
      mockRequest.params = { id: 'expense-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({ 
        userId: 'different-user-456',
        name: 'Other User Expense',
        amount: 100,
      }));

      await getExpenseById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject cached expense belonging to different user', async () => {
      mockRequest.params = { id: 'expense-abc123' };
      const cachedExpense = {
        success: true,
        data: {
          id: 'expense-abc123',
          userId: 'different-user-456', // Different user
          name: 'Other User Expense',
          amount: 100.00,
        }
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedExpense);

      await getExpenseById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createExpense', () => {
    it('should create a new expense with all required fields', async () => {
      mockRequest.body = {
        name: 'Restaurant Dinner',
        amount: 75.00,
        date: '2025-01-20',
        category: 'Dining',
        description: 'Birthday dinner',
        tags: ['dining', 'celebration'],
      };

      await createExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'new-expense-xyz789',
            name: 'Restaurant Dinner',
            amount: 75.00,
            category: 'Dining',
          }),
          message: 'Expense created successfully',
        })
      );
    });

    it('should create expense with minimal required fields', async () => {
      mockRequest.body = {
        name: 'Quick Purchase',
        amount: 10.00,
        date: '2025-01-20',
        category: 'Other',
      };

      await createExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it('should invalidate cache pattern after creation', async () => {
      mockRequest.body = {
        name: 'New Expense',
        amount: 50.00,
        date: '2025-01-20',
        category: 'Shopping',
      };

      await createExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should invalidate all expense list caches for the user
      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('expenses:user-123:*');
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        name: 'Test Expense',
        amount: 50.00,
        date: '2025-01-20',
        category: 'Test',
      };

      await createExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for missing required fields', async () => {
      mockRequest.body = {
        name: 'Incomplete Expense',
        // Missing: amount, date, category
      };

      await createExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateExpense', () => {
    it('should update an existing expense', async () => {
      mockRequest.params = { id: 'expense-abc123' };
      mockRequest.body = { 
        amount: 95.00,
        description: 'Updated grocery bill',
      };

      await updateExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(firebaseMocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 95.00,
          description: 'Updated grocery bill',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should update expense tags', async () => {
      mockRequest.params = { id: 'expense-abc123' };
      mockRequest.body = { 
        tags: ['groceries', 'weekly', 'essentials'],
      };

      await updateExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should call next with error for non-existent expense', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      mockRequest.body = { amount: 100 };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await updateExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate both list and single expense cache after update', async () => {
      mockRequest.params = { id: 'expense-abc123' };
      mockRequest.body = { amount: 100 };

      await updateExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should invalidate list caches and specific expense cache
      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('expenses:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('expense:expense-abc123');
    });
  });

  describe('deleteExpense', () => {
    it('should delete an existing expense', async () => {
      mockRequest.params = { id: 'expense-abc123' };

      await deleteExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(firebaseMocks.mockDelete).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Expense deleted successfully',
        })
      );
    });

    it('should call next with error for non-existent expense', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await deleteExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized deletion', async () => {
      mockRequest.params = { id: 'expense-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({ 
        userId: 'different-user-456',
        name: 'Other User Expense',
      }));

      await deleteExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate both list and single expense cache after deletion', async () => {
      mockRequest.params = { id: 'expense-abc123' };

      await deleteExpense(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should invalidate list caches and specific expense cache
      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('expenses:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('expense:expense-abc123');
    });
  });
});
