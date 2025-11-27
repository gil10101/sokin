/**
 * Bill Reminders Controller Unit Tests
 * 
 * Tests bill reminder CRUD operations including:
 * - Input validation
 * - Authorization checks
 * - Caching behavior
 * - Payment tracking
 */

import { Request, Response, NextFunction } from 'express';
import {
  getUserBillReminders,
  getBillReminderById,
  createBillReminder,
  markBillAsPaid,
  updateBillReminder,
  deleteBillReminder,
} from '../../../src/controllers/billRemindersController';

// Import mock data templates
import { createMockBillReminder, mockBillReminderData } from '../../__mocks__/firebase-admin';

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
    id: 'bill-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      name: 'Electric Bill',
      amount: 150,
      dueDate: '2025-02-01T00:00:00.000Z',
      frequency: 'monthly',
      category: 'utilities',
      description: 'Monthly electricity',
      isPaid: false,
      reminderDays: [7, 3, 1],
      autoPayEnabled: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    })),
  };

  const mockAdd = jest.fn().mockResolvedValue({ id: 'new-bill-xyz789' });
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

describe('Bill Reminders Controller', () => {
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
      name: 'Electric Bill',
      amount: 150,
      dueDate: '2025-02-01T00:00:00.000Z',
      frequency: 'monthly',
      category: 'utilities',
      description: 'Monthly electricity',
      isPaid: false,
      reminderDays: [7, 3, 1],
      autoPayEnabled: false,
      createdAt: '2025-01-01T00:00:00.000Z',
    }));
    firebaseMocks.mockDoc.exists = true;

    // Reset cache mocks
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.delAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.invalidatePatternAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getUserBillReminders', () => {
    it('should return all bill reminders for authenticated user', async () => {
      await getUserBillReminders(
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

    it('should return cached bills when available', async () => {
      const cachedResult = {
        success: true,
        data: [
          createMockBillReminder({ name: 'Internet', amount: 60 }),
          createMockBillReminder({ name: 'Phone', amount: 45 }),
        ],
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

      await getUserBillReminders(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(cachedResult);
    });

    it('should cache bills after database fetch', async () => {
      await getUserBillReminders(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.setAsync).toHaveBeenCalledWith(
        'bills:user-123:list',
        expect.objectContaining({ success: true }),
        expect.any(Number)
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getUserBillReminders(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getBillReminderById', () => {
    it('should return bill by ID with correct structure', async () => {
      mockRequest.params = { billId: 'bill-abc123' };

      await getBillReminderById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'bill-abc123',
            name: 'Electric Bill',
            amount: 150,
            frequency: 'monthly',
          }),
        })
      );
    });

    it('should return cached bill when available', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      const cachedBill = {
        success: true,
        data: { ...mockBillReminderData, id: 'bill-abc123', userId: 'user-123' },
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedBill);

      await getBillReminderById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(cachedBill);
    });

    it('should call next with error for non-existent bill', async () => {
      mockRequest.params = { billId: 'non-existent-id' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await getBillReminderById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized access', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({
        userId: 'different-user-456',
        name: 'Other User Bill',
      }));

      await getBillReminderById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createBillReminder', () => {
    it('should create a new bill reminder with all fields', async () => {
      mockRequest.body = {
        name: 'Rent',
        amount: 1500,
        dueDate: '2025-02-01',
        frequency: 'monthly',
        category: 'housing',
        description: 'Monthly rent payment',
        reminderDays: [5, 2, 1],
        autoPayEnabled: true,
      };

      await createBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: 'new-bill-xyz789',
            name: 'Rent',
            amount: 1500,
            isPaid: false,
          }),
          message: 'Bill reminder created successfully',
        })
      );
    });

    it('should use default reminder days if not provided', async () => {
      mockRequest.body = {
        name: 'Subscription',
        amount: 15,
        dueDate: '2025-02-15',
        frequency: 'monthly',
        category: 'entertainment',
      };

      await createBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(firebaseMocks.mockAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderDays: [7, 3, 1], // Default value
        })
      );
    });

    it('should invalidate cache after creation', async () => {
      mockRequest.body = {
        name: 'New Bill',
        amount: 100,
        dueDate: '2025-03-01',
        frequency: 'monthly',
        category: 'utilities',
      };

      await createBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('bills:user-123:*');
    });

    it('should call next with error for unauthenticated user', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { name: 'Test Bill', amount: 50 };

      await createBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('markBillAsPaid', () => {
    it('should mark bill as paid with current date', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      mockRequest.body = {};

      await markBillAsPaid(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Bill marked as paid successfully',
        })
      );
      expect(firebaseMocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          isPaid: true,
          paidDate: expect.any(String),
        })
      );
    });

    it('should mark bill as paid with custom date', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      mockRequest.body = { paidDate: '2025-01-20T00:00:00.000Z' };

      await markBillAsPaid(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(firebaseMocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          isPaid: true,
          paidDate: '2025-01-20T00:00:00.000Z',
        })
      );
    });

    it('should call next with error for non-existent bill', async () => {
      mockRequest.params = { billId: 'non-existent' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await markBillAsPaid(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate caches after marking as paid', async () => {
      mockRequest.params = { billId: 'bill-abc123' };

      await markBillAsPaid(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('bills:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('bill:bill-abc123');
    });
  });

  describe('updateBillReminder', () => {
    it('should update an existing bill reminder', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      mockRequest.body = {
        name: 'Updated Electric Bill',
        amount: 175,
      };

      await updateBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Bill reminder updated successfully',
        })
      );
      expect(firebaseMocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Electric Bill',
          amount: 175,
          updatedAt: expect.any(String),
        })
      );
    });

    it('should call next with error for non-existent bill', async () => {
      mockRequest.params = { billId: 'non-existent' };
      mockRequest.body = { name: 'Test' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await updateBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized access', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      mockRequest.body = { name: 'Test' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({
        userId: 'different-user-456',
      }));

      await updateBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate caches after update', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      mockRequest.body = { amount: 200 };

      await updateBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('bills:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('bill:bill-abc123');
    });
  });

  describe('deleteBillReminder', () => {
    it('should delete an existing bill reminder', async () => {
      mockRequest.params = { billId: 'bill-abc123' };

      await deleteBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Bill reminder deleted successfully',
        })
      );
      expect(firebaseMocks.mockDelete).toHaveBeenCalled();
    });

    it('should call next with error for non-existent bill', async () => {
      mockRequest.params = { billId: 'non-existent' };
      firebaseMocks.mockDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await deleteBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthorized deletion', async () => {
      mockRequest.params = { billId: 'bill-abc123' };
      firebaseMocks.mockDoc.data = jest.fn(() => ({
        userId: 'different-user-456',
      }));

      await deleteBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should invalidate caches after deletion', async () => {
      mockRequest.params = { billId: 'bill-abc123' };

      await deleteBillReminder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('bills:user-123:*');
      expect(cache.delAsync).toHaveBeenCalledWith('bill:bill-abc123');
    });
  });
});

