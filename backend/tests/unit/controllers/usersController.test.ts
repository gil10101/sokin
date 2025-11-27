/**
 * Users Controller Unit Tests
 * 
 * Tests user profile operations including retrieval, creation,
 * caching, and error handling.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getUserProfile,
  updateUserProfile,
} from '../../../src/controllers/users';

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
  const mockUserDoc = {
    exists: true,
    id: 'user-123',
    data: jest.fn(() => ({
      uid: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
      createdAt: '2025-01-01T00:00:00.000Z',
      settings: {
        theme: 'light',
        currency: 'USD',
      },
    })),
  };

  const mockAuthUser = {
    uid: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: 'https://example.com/photo.jpg',
  };

  const mockSet = jest.fn().mockResolvedValue(undefined);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue(mockUserDoc);

  return {
    db: {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: mockGet,
          set: mockSet,
          update: mockUpdate,
        })),
      })),
    },
    auth: {
      getUser: jest.fn().mockResolvedValue(mockAuthUser),
    },
    __mocks: {
      mockUserDoc,
      mockAuthUser,
      mockSet,
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

import cache from '../../../src/utils/cache';
const firebaseMocks = require('../../../src/config/firebase').__mocks;

describe('Users Controller', () => {
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
    firebaseMocks.mockUserDoc.exists = true;
    firebaseMocks.mockUserDoc.data = jest.fn(() => ({
      uid: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
      createdAt: '2025-01-01T00:00:00.000Z',
      settings: {
        theme: 'light',
        currency: 'USD',
      },
    }));

    // Reset cache mocks
    (cache.getAsync as jest.Mock).mockResolvedValue(null);
    (cache.setAsync as jest.Mock).mockResolvedValue(undefined);
    (cache.delAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getUserProfile', () => {
    it('should return user profile for authenticated user', async () => {
      await getUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            email: 'test@example.com',
            displayName: 'Test User',
          }),
        })
      );
    });

    it('should return cached user profile when available', async () => {
      const cachedResult = {
        success: true,
        data: {
          uid: 'user-123',
          email: 'cached@example.com',
          displayName: 'Cached User',
        },
      };
      (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

      await getUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(cachedResult);
    });

    it('should cache user profile after database fetch', async () => {
      await getUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.setAsync).toHaveBeenCalledWith(
        'user:user-123:profile',
        expect.objectContaining({ success: true }),
        600 // CACHE_TTL.USER_SETTINGS
      );
    });

    it('should create user profile from Firebase Auth if not exists', async () => {
      firebaseMocks.mockUserDoc.exists = false;
      firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

      await getUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(firebaseMocks.mockSet).toHaveBeenCalled();
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      await getUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should include user ID in response', async () => {
      await getUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const response = jsonMock.mock.calls[0][0];
      expect(response.data.id).toBeDefined();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile with new data', async () => {
      mockRequest.body = {
        displayName: 'Updated User',
        settings: { theme: 'dark' },
      };

      await updateUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User profile updated successfully',
        })
      );
    });

    it('should only update provided fields', async () => {
      mockRequest.body = {
        displayName: 'New Name',
      };

      await updateUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(firebaseMocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'New Name',
          updatedAt: expect.any(String),
        })
      );
    });

    it('should invalidate cache after update', async () => {
      mockRequest.body = { displayName: 'Test' };

      await updateUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(cache.delAsync).toHaveBeenCalledWith('user:user-123:profile');
    });

    it('should call next with error for unauthenticated requests', async () => {
      mockRequest.user = undefined;
      mockRequest.body = { displayName: 'Test' };

      await updateUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle update failure gracefully', async () => {
      mockRequest.body = { displayName: 'Test' };
      firebaseMocks.mockUpdate.mockRejectedValueOnce(new Error('Update failed'));

      await updateUserProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

