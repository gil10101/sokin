/**
 * Budgets Controller Unit Tests
 * 
 * Tests budget CRUD operations including:
 * - Input validation
 * - Authorization checks
 * - Caching behavior
 * - Database operations
 */

import { Request, Response, NextFunction } from 'express';
import {
  getAllBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
} from '../../../src/controllers/budgets';

// Import mock data templates
import { createMockBudget } from '../../__mocks__/firebase-admin';

// Mock cache - all async methods
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

// Mock Firebase with realistic budget data
jest.mock('../../../src/config/firebase', () => {
  const mockDoc = {
    exists: true,
    id: 'budget-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      name: 'Monthly Food Budget',
      amount: 500,
      period: 'monthly',
      categories: ['Food', 'Dining'],
      startDate: '2025-01-01',
      endDate: null,
      isActive: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-15T10:30:00.000Z',
    })),
  };

  const mockAdd = jest.fn().mockResolvedValue({ id: 'new-budget-xyz789' });
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue(mockDoc);

  const mockQuerySnapshot = {
    docs: [mockDoc],
    empty: false,
  };

  // Chain builder for queries
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

// Import cache after mocking
import cache from '../../../src/utils/cache';
const firebaseMocks = require('../../../src/config/firebase').__mocks;

describe('Budgets Controller', () => {
  let mockRequest: Partial<Request>;
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

    // Reset mock doc data to default budget structure
    firebaseMocks.mockDoc.data = jest.fn(() => ({
      userId: 'user-123',
      name: 'Monthly Food Budget',
      amount: 500,
      period: 'monthly',
      categories: ['Food', 'Dining'],
      startDate: '2025-01-01',
      endDate: null,
      isActive: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-15T10:30:00.000Z',
    }));
    firebaseMocks.mockDoc.exists = true;
    
    // Reset cache mocks to return null (cache miss)
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.delAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getAllBudgets', () => {
    it('should return all budgets for authenticated user', async () => {
      await getAllBudgets(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.any(Object),
        })
      );
    });

    it('should return cached budgets when available', async () => {
      const cachedResult = {
        success: true,
        data: [
          createMockBudget({ name: 'Cached Food Budget', amount: 400 }),
          createMockBudget({ name: 'Cached Travel Budget', amount: 300, period: 'weekly', categories: ['Travel'] }),
        ],
        pagination: { count: 2, limit: 50, nextCursor: null, hasMore: false }
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

      await getAllBudgets(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(cachedResult);
    });

    it('should cache budgets after database fetch', async () => {
      await getAllBudgets(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.setAsync).toHaveBeenCalledWith(
        expect.stringMatching(/^budgets:user-123:/),
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        }),
        expect.any(Number)
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getAllBudgets(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getBudgetById', () => {
    it('should return budget by ID with correct structure', async () => {
      mockRequest.params = { id: 'budget-abc123' };

      await getBudgetById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'budget-abc123',
            name: 'Monthly Food Budget',
            amount: 500,
            period: 'monthly',
            categories: ['Food', 'Dining'],
          }),
        })
      );
    });

    it('should call next with error for non-existent budget', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await getBudgetById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized access', async () => {
      mockRequest.params = { id: 'budget-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({ 
        userId: 'different-user-456',
        name: 'Other User Budget',
      }));

      await getBudgetById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createBudget', () => {
    it('should create a new budget with all fields', async () => {
      mockRequest.body = {
        name: 'Entertainment Budget',
        amount: 200,
        period: 'monthly',
        categories: ['Entertainment', 'Subscriptions'],
        startDate: '2025-02-01',
      };

      await createBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'new-budget-xyz789',
            name: 'Entertainment Budget',
            amount: 200,
            period: 'monthly',
          }),
        })
      );
    });

    it('should create budget with different periods', async () => {
      const periods = ['daily', 'weekly', 'monthly', 'yearly'];
      
      for (const period of periods) {
        mockRequest.body = {
          name: `${period} Budget`,
          amount: 100,
          period,
          categories: ['General'],
        };

        await createBudget(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        jest.clearAllMocks();
        
        // Reset cache mocks
        (cache.getAsync as jest.Mock).mockResolvedValue(null);
        (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
        (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
      }
    });

    it('should invalidate cache after creation', async () => {
      mockRequest.body = {
        name: 'New Budget',
        amount: 300,
        period: 'monthly',
        categories: ['Shopping'],
      };

      await createBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('budgets:user-123:*');
    });
  });

  describe('updateBudget', () => {
    it('should update an existing budget', async () => {
      mockRequest.params = { id: 'budget-abc123' };
      mockRequest.body = { 
        amount: 600,
        categories: ['Food', 'Dining', 'Groceries'],
      };

      await updateBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(firebaseMocks.mockUpdate).toHaveBeenCalled();
    });

    it('should update budget alert thresholds', async () => {
      mockRequest.params = { id: 'budget-abc123' };
      mockRequest.body = { 
        alertThresholds: [
          { percentage: 75, type: 'warning', notified: false },
          { percentage: 90, type: 'critical', notified: false },
          { percentage: 100, type: 'exceeded', notified: false },
        ],
      };

      await updateBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should call next with error for non-existent budget', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      mockRequest.body = { amount: 600 };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await updateBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate cache after update', async () => {
      mockRequest.params = { id: 'budget-abc123' };
      mockRequest.body = { amount: 600 };

      await updateBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('budgets:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('budget:budget-abc123');
    });
  });

  describe('deleteBudget', () => {
    it('should delete an existing budget', async () => {
      mockRequest.params = { id: 'budget-abc123' };

      await deleteBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(firebaseMocks.mockDelete).toHaveBeenCalled();
    });

    it('should call next with error for non-existent budget', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await deleteBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized deletion', async () => {
      mockRequest.params = { id: 'budget-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({ 
        userId: 'different-user-456',
        name: 'Other User Budget',
      }));

      await deleteBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate cache after deletion', async () => {
      mockRequest.params = { id: 'budget-abc123' };

      await deleteBudget(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('budgets:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('budget:budget-abc123');
    });
  });
});
