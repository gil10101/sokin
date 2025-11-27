/**
 * Dashboard Controller Unit Tests
 * 
 * Tests dashboard data aggregation, caching behavior, and error handling.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getDashboard,
  invalidateDashboardCache,
} from '../../../src/controllers/dashboardController';

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
  },
}));

// Mock Firebase
jest.mock('../../../src/config/firebase', () => {
  const mockExpenseDoc = {
    id: 'expense-123',
    data: jest.fn(() => ({
      userId: 'user-123',
      name: 'Groceries',
      amount: 150,
      date: '2025-01-15',
      category: 'Food',
    })),
  };

  const mockBudgetDoc = {
    id: 'budget-123',
    data: jest.fn(() => ({
      userId: 'user-123',
      name: 'Monthly Food',
      amount: 500,
      period: 'monthly',
      currentSpent: 150,
    })),
  };

  const mockNotificationDoc = {
    id: 'notification-123',
    data: jest.fn(() => ({
      userId: 'user-123',
      type: 'budget_warning',
      title: 'Budget Alert',
      message: 'You have spent 80% of your budget',
      read: false,
    })),
  };

  const mockExpensesSnapshot = {
    docs: [mockExpenseDoc, mockExpenseDoc],
    empty: false,
  };

  const mockBudgetsSnapshot = {
    docs: [mockBudgetDoc],
    empty: false,
  };

  const mockNotificationsSnapshot = {
    docs: [mockNotificationDoc],
    empty: false,
  };

  // Create chainable query mock
  const createQueryMock = (snapshot: unknown) => ({
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(snapshot),
  });

  return {
    db: {
      collection: jest.fn((name: string) => {
        switch (name) {
          case 'expenses':
            return createQueryMock(mockExpensesSnapshot);
          case 'budgets':
            return createQueryMock(mockBudgetsSnapshot);
          case 'notifications':
            return createQueryMock(mockNotificationsSnapshot);
          default:
            return createQueryMock({ docs: [], empty: true });
        }
      }),
    },
    __mocks: {
      mockExpenseDoc,
      mockBudgetDoc,
      mockNotificationDoc,
    },
  };
});

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

import cache from '../../../src/utils/cache';

describe('Dashboard Controller', () => {
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

    // Reset cache mocks
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.delAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getDashboard', () => {
    it('should return dashboard data for authenticated user', async () => {
      await getDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            expenses: expect.any(Array),
            budgets: expect.any(Array),
            notifications: expect.any(Array),
          }),
        })
      );
    });

    it('should return cached dashboard when available', async () => {
      const cachedResult = {
        expenses: [{ id: 'exp-1', name: 'Cached Expense', amount: 100 }],
        budgets: [{ id: 'bud-1', name: 'Cached Budget', amount: 500 }],
        notifications: [{ id: 'not-1', title: 'Cached Notification' }],
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

      await getDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: cachedResult,
      });
    });

    it('should cache dashboard after database fetch', async () => {
      await getDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.setAsync).toHaveBeenCalledWith(
        'dashboard:user-123',
        expect.objectContaining({
          expenses: expect.any(Array),
          budgets: expect.any(Array),
          notifications: expect.any(Array),
        }),
        600 // CACHE_TTL.DASHBOARD
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should fetch data in parallel for optimal performance', async () => {
      await getDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify all collections were queried
      const db = require('../../../src/config/firebase').db;
      expect(db.collection).toHaveBeenCalledWith('expenses');
      expect(db.collection).toHaveBeenCalledWith('budgets');
      expect(db.collection).toHaveBeenCalledWith('notifications');
    });

    it('should include correct number of items per collection', async () => {
      await getDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.expenses.length).toBe(2); // Based on mock
      expect(response.data.budgets.length).toBe(1);
      expect(response.data.notifications.length).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      const db = require('../../../src/config/firebase').db;
      db.collection.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      await getDashboard(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('invalidateDashboardCache', () => {
    it('should delete dashboard cache for user', async () => {
      await invalidateDashboardCache('user-123');

      expect(cache.delAsync).toHaveBeenCalledWith('dashboard:user-123');
    });

    it('should not throw on cache deletion failure', async () => {
      (cache.delAsync as jest.Mock).mockRejectedValue(new Error('Cache error'));

      // Should not throw
      await expect(invalidateDashboardCache('user-123')).resolves.not.toThrow();
    });
  });
});

