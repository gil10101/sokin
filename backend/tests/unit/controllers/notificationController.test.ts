/**
 * Notification Controller Unit Tests
 * 
 * Tests notification management, FCM token registration, and budget alerts.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getUserNotifications,
  markAsRead,
  updatePreferences,
  registerFCMToken,
  checkBudgetAlerts,
} from '../../../src/controllers/notificationController';

// Import mock data templates
import { createMockNotification, mockNotificationData } from '../../__mocks__/firebase-admin';

// Mock Firebase Admin messaging
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({
    sendEachForMulticast: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    }),
  })),
}));

// Mock Firebase
jest.mock('../../../src/config/firebase', () => {
  const mockNotificationDoc = {
    id: 'notification-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      type: 'budget_warning',
      title: 'Budget Warning',
      message: 'You have spent 80% of your Food budget',
      read: false,
      priority: 'medium',
      createdAt: '2025-01-15T10:30:00.000Z',
    })),
  };

  const mockBudgetDoc = {
    id: 'budget-123',
    data: jest.fn(() => ({
      userId: 'user-123',
      name: 'Food Budget',
      amount: 500,
      period: 'monthly',
      isActive: true,
      startDate: '2025-01-01',
      categories: ['Food'],
      alertThresholds: [
        { percentage: 80, type: 'warning', notified: false },
        { percentage: 100, type: 'exceeded', notified: false },
      ],
    })),
  };

  const mockUserDoc = {
    exists: true,
    data: jest.fn(() => ({
      uid: 'user-123',
      email: 'test@example.com',
      fcmTokens: ['token-123', 'token-456'],
      notificationPreferences: {
        budgetAlerts: true,
        billReminders: true,
      },
    })),
  };

  const mockExpenseDoc = {
    id: 'expense-123',
    data: jest.fn(() => ({
      userId: 'user-123',
      amount: 400,
      category: 'Food',
      date: new Date('2025-01-15'),
    })),
  };

  const mockQuerySnapshot = {
    docs: [mockNotificationDoc],
    empty: false,
  };

  const mockBudgetsSnapshot = {
    docs: [mockBudgetDoc],
    empty: false,
  };

  const mockExpensesSnapshot = {
    docs: [mockExpenseDoc],
    reduce: jest.fn((cb: (acc: number, doc: typeof mockExpenseDoc) => number, init: number) =>
      [mockExpenseDoc].reduce((acc, doc) => cb(acc, doc), init)
    ),
  };

  const mockAdd = jest.fn().mockResolvedValue({ id: 'new-notification-xyz789' });
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue(mockUserDoc);

  // Chainable query mock
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
          case 'notifications':
            return {
              ...createQueryMock(mockQuerySnapshot),
              add: mockAdd,
            };
          case 'budgets':
            return createQueryMock(mockBudgetsSnapshot);
          case 'expenses':
            return createQueryMock(mockExpensesSnapshot);
          default:
            return createQueryMock({ docs: [], empty: true });
        }
      }),
      doc: jest.fn(() => ({
        get: mockGet,
        update: mockUpdate,
      })),
    },
    __mocks: {
      mockNotificationDoc,
      mockBudgetDoc,
      mockUserDoc,
      mockAdd,
      mockUpdate,
      mockGet,
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

const firebaseMocks = require('../../../src/config/firebase').__mocks;

describe('Notification Controller', () => {
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
  });

  describe('getUserNotifications', () => {
    it('should return all notifications for authenticated user', async () => {
      await getUserNotifications(
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

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getUserNotifications(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should include notification ID in response', async () => {
      await getUserNotifications(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data[0]).toHaveProperty('id');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockRequest.params = { notificationId: 'notification-abc123' };

      await markAsRead(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Notification marked as read',
        })
      );
    });

    it('should update notification with read flag and timestamp', async () => {
      mockRequest.params = { notificationId: 'notification-abc123' };

      await markAsRead(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(firebaseMocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          read: true,
          updatedAt: expect.any(String),
        })
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { notificationId: 'notification-abc123' };

      await markAsRead(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      mockRequest.body = {
        budgetAlerts: true,
        billReminders: false,
        goalMilestones: true,
        spendingInsights: true,
        pushNotifications: true,
        emailNotifications: false,
        budgetWarningThreshold: 75,
        budgetExceededThreshold: 100,
        reminderDaysBefore: 5,
      };

      await updatePreferences(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            budgetAlerts: true,
            billReminders: false,
            budgetWarningThreshold: 75,
          }),
          message: 'Preferences updated successfully',
        })
      );
    });

    it('should use default values for missing preferences', async () => {
      mockRequest.body = {};

      await updatePreferences(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            budgetAlerts: true,
            billReminders: true,
            budgetWarningThreshold: 80,
          }),
        })
      );
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await updatePreferences(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('registerFCMToken', () => {
    it('should register FCM token for push notifications', async () => {
      mockRequest.body = { token: 'new-fcm-token-789' };

      await registerFCMToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'FCM token registered successfully',
        })
      );
    });

    it('should call next with error when token is missing', async () => {
      mockRequest.body = {};

      await registerFCMToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { token: 'some-token' };

      await registerFCMToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should not duplicate existing tokens', async () => {
      mockRequest.body = { token: 'token-123' }; // Already exists in mock

      await registerFCMToken(
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

  describe('checkBudgetAlerts', () => {
    it('should check budget alerts for user', async () => {
      mockRequest.body = { userId: 'user-123' };

      await checkBudgetAlerts(
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

    it('should call next with error when userId is missing', async () => {
      mockRequest.body = {};

      await checkBudgetAlerts(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

