/**
 * Goals Controller Unit Tests
 * 
 * Tests savings goal CRUD operations including:
 * - Input validation
 * - Authorization checks
 * - Caching behavior
 * - Contribution tracking
 * - Milestone updates
 */

import { Request, Response, NextFunction } from 'express';
import {
  getUserGoals,
  getGoalById,
  createGoal,
  addContribution,
  updateGoal,
  deleteGoal,
} from '../../../src/controllers/goalsController';

// Import mock data templates
import { createMockGoal, mockGoalData } from '../../__mocks__/firebase-admin';

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
  const mockDoc = {
    exists: true,
    id: 'goal-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      name: 'Emergency Fund',
      description: 'Build emergency savings',
      targetAmount: 10000,
      currentAmount: 2500,
      targetDate: '2026-01-01',
      category: 'savings',
      priority: 'high',
      isCompleted: false,
      contributions: [],
      milestones: [
        { percentage: 25, amount: 2500 },
        { percentage: 50, amount: 5000 },
        { percentage: 75, amount: 7500 },
        { percentage: 100, amount: 10000 },
      ],
      createdAt: '2025-01-01T00:00:00.000Z',
    })),
  };

  const mockAdd = jest.fn().mockResolvedValue({ id: 'new-goal-xyz789' });
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue(mockDoc);

  const mockQuerySnapshot = {
    docs: [mockDoc],
    empty: false,
  };

  return {
    db: {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: mockGet,
          update: mockUpdate,
          delete: mockDelete,
        })),
        add: mockAdd,
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockQuerySnapshot),
        })),
      })),
    },
    __mocks: { mockDoc, mockAdd, mockUpdate, mockDelete, mockGet },
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
const firebaseMocks = require('../../../src/config/firebase').__mocks;

describe('Goals Controller', () => {
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

    // Reset mock doc data
    firebaseMocks.mockDoc.data = jest.fn(() => ({
      userId: 'user-123',
      name: 'Emergency Fund',
      description: 'Build emergency savings',
      targetAmount: 10000,
      currentAmount: 2500,
      targetDate: '2026-01-01',
      category: 'savings',
      priority: 'high',
      isCompleted: false,
      contributions: [],
      milestones: [
        { percentage: 25, amount: 2500 },
        { percentage: 50, amount: 5000 },
        { percentage: 75, amount: 7500 },
        { percentage: 100, amount: 10000 },
      ],
      createdAt: '2025-01-01T00:00:00.000Z',
    }));
    firebaseMocks.mockDoc.exists = true;

    // Reset cache mocks
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.delAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getUserGoals', () => {
    it('should return all goals for authenticated user', async () => {
      await getUserGoals(
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

    it('should return cached goals when available', async () => {
      const cachedResult = {
        success: true,
        data: [
          createMockGoal({ name: 'Vacation Fund', targetAmount: 5000 }),
          createMockGoal({ name: 'New Car', targetAmount: 20000 }),
        ],
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

      await getUserGoals(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(cachedResult);
    });

    it('should cache goals after database fetch', async () => {
      await getUserGoals(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.setAsync).toHaveBeenCalledWith(
        'goals:user-123:list',
        expect.objectContaining({ success: true }),
        expect.any(Number)
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getUserGoals(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getGoalById', () => {
    it('should return goal by ID with correct structure', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };

      await getGoalById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'goal-abc123',
            name: 'Emergency Fund',
            targetAmount: 10000,
          }),
        })
      );
    });

    it('should return cached goal when available', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      const cachedGoal = {
        success: true,
        data: { ...mockGoalData, id: 'goal-abc123', userId: 'user-123' },
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedGoal);

      await getGoalById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(cachedGoal);
    });

    it('should call next with error for non-existent goal', async () => {
      mockRequest.params = { goalId: 'non-existent-id' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await getGoalById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized access', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({
        userId: 'different-user-456',
        name: 'Other User Goal',
      }));

      await getGoalById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createGoal', () => {
    it('should create a new goal with all fields', async () => {
      mockRequest.body = {
        name: 'House Down Payment',
        description: 'Save for house',
        targetAmount: 50000,
        targetDate: '2027-01-01',
        category: 'housing',
        priority: 'high',
      };

      await createGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'new-goal-xyz789',
            name: 'House Down Payment',
            targetAmount: 50000,
            currentAmount: 0,
            isCompleted: false,
          }),
          message: 'Goal created successfully',
        })
      );
    });

    it('should auto-generate milestones if not provided', async () => {
      mockRequest.body = {
        name: 'Test Goal',
        targetAmount: 1000,
        targetDate: '2025-12-31',
        category: 'general',
        priority: 'medium',
      };

      await createGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(firebaseMocks.mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          milestones: expect.arrayContaining([
            expect.objectContaining({ percentage: 25 }),
            expect.objectContaining({ percentage: 50 }),
            expect.objectContaining({ percentage: 75 }),
            expect.objectContaining({ percentage: 100 }),
          ]),
        })
      );
    });

    it('should invalidate cache after creation', async () => {
      mockRequest.body = {
        name: 'New Goal',
        targetAmount: 5000,
        targetDate: '2025-12-31',
        category: 'savings',
        priority: 'low',
      };

      await createGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('goals:user-123:*');
    });
  });

  describe('addContribution', () => {
    it('should add contribution and update current amount', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      mockRequest.body = {
        amount: 500,
        method: 'manual',
        source: 'Savings',
        note: 'Monthly contribution',
      };

      await addContribution(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            currentAmount: 3000, // 2500 + 500
            isCompleted: false,
          }),
          message: 'Contribution added successfully',
        })
      );
    });

    it('should mark goal as completed when target reached', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      mockRequest.body = { amount: 7500 }; // 2500 + 7500 = 10000 (target)

      await addContribution(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentAmount: 10000,
            isCompleted: true,
          }),
        })
      );
    });

    it('should call next with error for non-existent goal', async () => {
      mockRequest.params = { goalId: 'non-existent' };
      mockRequest.body = { amount: 100 };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await addContribution(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate caches after contribution', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      mockRequest.body = { amount: 100 };

      await addContribution(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('goals:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('goal:goal-abc123');
    });
  });

  describe('updateGoal', () => {
    it('should update an existing goal', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      mockRequest.body = {
        name: 'Updated Emergency Fund',
        targetAmount: 15000,
      };

      await updateGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Goal updated successfully',
        })
      );
      expect(firebaseMocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Emergency Fund',
          targetAmount: 15000,
          updatedAt: expect.any(String),
        })
      );
    });

    it('should call next with error for non-existent goal', async () => {
      mockRequest.params = { goalId: 'non-existent' };
      mockRequest.body = { name: 'Test' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await updateGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate caches after update', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      mockRequest.body = { name: 'Updated' };

      await updateGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('goals:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('goal:goal-abc123');
    });
  });

  describe('deleteGoal', () => {
    it('should delete an existing goal', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };

      await deleteGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Goal deleted successfully',
        })
      );
      expect(firebaseMocks.mockDelete).toHaveBeenCalled();
    });

    it('should call next with error for non-existent goal', async () => {
      mockRequest.params = { goalId: 'non-existent' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await deleteGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized deletion', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({
        userId: 'different-user-456',
      }));

      await deleteGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate caches after deletion', async () => {
      mockRequest.params = { goalId: 'goal-abc123' };

      await deleteGoal(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('goals:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('goal:goal-abc123');
    });
  });
});

