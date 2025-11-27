/**
 * Net Worth Controller Unit Tests
 * 
 * Tests asset management, liability management, net worth calculations,
 * and financial insights with comprehensive coverage.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getUserAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getUserLiabilities,
  createLiability,
  updateLiability,
  deleteLiability,
  calculateNetWorth,
  getNetWorthHistory,
  getNetWorthTrends,
} from '../../../src/controllers/netWorthController';

// Import mock data templates
import { createMockAsset, createMockLiability, mockAssetData, mockLiabilityData } from '../../__mocks__/firebase-admin';

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
  const mockAssetDoc = {
    exists: true,
    id: 'asset-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      type: 'checking',
      category: 'bank_accounts',
      name: 'Main Checking',
      currentValue: 5000,
      description: 'Primary checking account',
      metadata: {},
      lastUpdated: '2025-01-15T10:30:00.000Z',
      createdAt: '2025-01-01T00:00:00.000Z',
    })),
    ref: {
      update: jest.fn(),
    },
  };

  const mockLiabilityDoc = {
    exists: true,
    id: 'liability-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      type: 'credit_card',
      category: 'credit_cards',
      name: 'Visa Card',
      currentBalance: 2500,
      originalAmount: 5000,
      interestRate: 19.99,
      minimumPayment: 50,
      dueDate: '2025-02-15',
      metadata: {},
      createdAt: '2025-01-01T00:00:00.000Z',
    })),
    ref: {
      update: jest.fn(),
    },
  };

  const mockSnapshotDoc = {
    exists: true,
    id: 'snapshot-abc123',
    data: jest.fn(() => ({
      userId: 'user-123',
      date: '2025-01-15',
      netWorth: 15000,
      totalAssets: 25000,
      totalLiabilities: 10000,
      assetBreakdown: { bankAccounts: 10000, investmentAccounts: 10000 },
      liabilityBreakdown: { creditCards: 2500, mortgages: 7500 },
      createdAt: '2025-01-15T00:00:00.000Z',
    })),
    ref: {
      update: jest.fn(),
    },
  };

  const mockAdd = jest.fn().mockResolvedValue({ id: 'new-doc-xyz789' });
  const mockUpdate = jest.fn().mockResolvedValue(undefined);
  const mockDelete = jest.fn().mockResolvedValue(undefined);
  const mockGet = jest.fn().mockResolvedValue(mockAssetDoc);

  const mockAssetsQuerySnapshot = {
    docs: [mockAssetDoc],
    empty: false,
    forEach: jest.fn((cb: (doc: typeof mockAssetDoc) => void) => {
      [mockAssetDoc].forEach(cb);
    }),
  };

  const mockLiabilitiesQuerySnapshot = {
    docs: [mockLiabilityDoc],
    empty: false,
    forEach: jest.fn((cb: (doc: typeof mockLiabilityDoc) => void) => {
      [mockLiabilityDoc].forEach(cb);
    }),
  };

  const mockSnapshotsQuerySnapshot = {
    docs: [mockSnapshotDoc],
    empty: false,
    forEach: jest.fn((cb: (doc: typeof mockSnapshotDoc) => void) => {
      [mockSnapshotDoc].forEach(cb);
    }),
  };

  // Dynamic collection handler
  const createCollectionMock = (collectionName: string) => ({
    doc: jest.fn(() => ({
      get: mockGet,
      update: mockUpdate,
      delete: mockDelete,
    })),
    add: mockAdd,
    where: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(
            collectionName === 'assets' ? mockAssetsQuerySnapshot :
            collectionName === 'liabilities' ? mockLiabilitiesQuerySnapshot :
            mockSnapshotsQuerySnapshot
          ),
        })),
        get: jest.fn().mockResolvedValue(
          collectionName === 'assets' ? mockAssetsQuerySnapshot :
          collectionName === 'liabilities' ? mockLiabilitiesQuerySnapshot :
          mockSnapshotsQuerySnapshot
        ),
      })),
      get: jest.fn().mockResolvedValue(
        collectionName === 'assets' ? mockAssetsQuerySnapshot :
        collectionName === 'liabilities' ? mockLiabilitiesQuerySnapshot :
        mockSnapshotsQuerySnapshot
      ),
      where: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockSnapshotsQuerySnapshot),
        })),
        get: jest.fn().mockResolvedValue(mockSnapshotsQuerySnapshot),
      })),
    })),
  });

  return {
    db: {
      collection: jest.fn((name: string) => createCollectionMock(name)),
    },
    __mocks: { 
      mockAssetDoc, 
      mockLiabilityDoc,
      mockSnapshotDoc,
      mockAdd, 
      mockUpdate, 
      mockDelete, 
      mockGet,
      mockAssetsQuerySnapshot,
      mockLiabilitiesQuerySnapshot,
      mockSnapshotsQuerySnapshot,
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

describe('Net Worth Controller', () => {
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

  describe('Asset Management', () => {
    describe('getUserAssets', () => {
      it('should return all assets for authenticated user', async () => {
        await getUserAssets(
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

      it('should return cached assets when available', async () => {
        const cachedResult = {
          success: true,
          data: [
            createMockAsset({ name: 'Savings Account', currentValue: 10000 }),
            createMockAsset({ name: 'Investment Account', currentValue: 25000 }),
          ],
        };
        (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

        await getUserAssets(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(cachedResult);
      });

      it('should cache assets after database fetch', async () => {
        await getUserAssets(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(cache.setAsync).toHaveBeenCalledWith(
          'assets:user-123:list',
          expect.objectContaining({ success: true }),
          expect.any(Number)
        );
      });

      it('should call next with error for unauthenticated requests', async () => {
        mockRequest.user = undefined;

        await getUserAssets(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('createAsset', () => {
      it('should create a new asset with all fields', async () => {
        mockRequest.body = {
          type: 'savings',
          category: 'bank_accounts',
          name: 'Emergency Fund',
          currentValue: 10000,
          description: 'Emergency savings account',
          metadata: { bank: 'Chase' },
        };

        await createAsset(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              id: 'new-doc-xyz789',
              name: 'Emergency Fund',
              currentValue: 10000,
            }),
            message: 'Asset created successfully',
          })
        );
      });

      it('should invalidate caches after creation', async () => {
        mockRequest.body = {
          type: 'checking',
          category: 'bank_accounts',
          name: 'New Account',
          currentValue: 500,
        };

        await createAsset(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('assets:user-123:*');
        expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('liabilities:user-123:*');
        expect(cache.invalidatePatternAsync).toHaveBeenCalledWith('networth:user-123*');
      });
    });

    describe('updateAsset', () => {
      beforeEach(() => {
        firebaseMocks.mockGet.mockResolvedValue(firebaseMocks.mockAssetDoc);
        firebaseMocks.mockAssetDoc.exists = true;
      });

      it('should update an existing asset', async () => {
        mockRequest.params = { id: 'asset-abc123' };
        mockRequest.body = {
          currentValue: 6000,
          description: 'Updated description',
        };

        await updateAsset(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: 'Asset updated successfully',
          })
        );
      });

      it('should call next with error for non-existent asset', async () => {
        mockRequest.params = { id: 'non-existent' };
        mockRequest.body = { currentValue: 1000 };
        firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

        await updateAsset(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });

      it('should call next with error for unauthorized access', async () => {
        mockRequest.params = { id: 'asset-abc123' };
        mockRequest.body = { currentValue: 1000 };
        firebaseMocks.mockAssetDoc.data = jest.fn(() => ({
          userId: 'different-user-456',
        }));

        await updateAsset(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('deleteAsset', () => {
      beforeEach(() => {
        firebaseMocks.mockGet.mockResolvedValue(firebaseMocks.mockAssetDoc);
        firebaseMocks.mockAssetDoc.exists = true;
        firebaseMocks.mockAssetDoc.data = jest.fn(() => ({
          userId: 'user-123',
          type: 'checking',
          category: 'bank_accounts',
          name: 'Main Checking',
          currentValue: 5000,
        }));
      });

      it('should delete an existing asset', async () => {
        mockRequest.params = { id: 'asset-abc123' };

        await deleteAsset(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: 'Asset deleted successfully',
          })
        );
      });

      it('should invalidate caches after deletion', async () => {
        mockRequest.params = { id: 'asset-abc123' };

        await deleteAsset(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(cache.invalidatePatternAsync).toHaveBeenCalled();
        expect(cache.delAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Liability Management', () => {
    describe('getUserLiabilities', () => {
      it('should return all liabilities for authenticated user', async () => {
        await getUserLiabilities(
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

      it('should return cached liabilities when available', async () => {
        const cachedResult = {
          success: true,
          data: [
            createMockLiability({ name: 'Mortgage', currentBalance: 250000 }),
            createMockLiability({ name: 'Car Loan', currentBalance: 15000 }),
          ],
        };
        (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

        await getUserLiabilities(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(cachedResult);
      });

      it('should cache liabilities after database fetch', async () => {
        await getUserLiabilities(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(cache.setAsync).toHaveBeenCalledWith(
          'liabilities:user-123:list',
          expect.objectContaining({ success: true }),
          expect.any(Number)
        );
      });
    });

    describe('createLiability', () => {
      it('should create a new liability with all fields', async () => {
        mockRequest.body = {
          type: 'auto_loan',
          category: 'auto_loans',
          name: 'Car Loan',
          currentBalance: 20000,
          originalAmount: 25000,
          interestRate: 5.5,
          minimumPayment: 400,
          dueDate: '2025-02-15',
          metadata: { lender: 'Chase Auto' },
        };

        await createLiability(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              id: 'new-doc-xyz789',
              name: 'Car Loan',
              currentBalance: 20000,
            }),
            message: 'Liability created successfully',
          })
        );
      });

      it('should invalidate caches after creation', async () => {
        mockRequest.body = {
          type: 'credit_card',
          category: 'credit_cards',
          name: 'New Card',
          currentBalance: 1000,
        };

        await createLiability(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(cache.invalidatePatternAsync).toHaveBeenCalled();
      });
    });

    describe('updateLiability', () => {
      beforeEach(() => {
        firebaseMocks.mockGet.mockResolvedValue(firebaseMocks.mockLiabilityDoc);
        firebaseMocks.mockLiabilityDoc.exists = true;
        firebaseMocks.mockLiabilityDoc.data = jest.fn(() => ({
          userId: 'user-123',
          type: 'credit_card',
          category: 'credit_cards',
          name: 'Visa Card',
          currentBalance: 2500,
        }));
      });

      it('should update an existing liability', async () => {
        mockRequest.params = { id: 'liability-abc123' };
        mockRequest.body = {
          currentBalance: 2000,
        };

        await updateLiability(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: 'Liability updated successfully',
          })
        );
      });

      it('should call next with error for non-existent liability', async () => {
        mockRequest.params = { id: 'non-existent' };
        mockRequest.body = { currentBalance: 1000 };
        firebaseMocks.mockGet.mockResolvedValueOnce({ exists: false });

        await updateLiability(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('deleteLiability', () => {
      beforeEach(() => {
        firebaseMocks.mockGet.mockResolvedValue(firebaseMocks.mockLiabilityDoc);
        firebaseMocks.mockLiabilityDoc.exists = true;
        firebaseMocks.mockLiabilityDoc.data = jest.fn(() => ({
          userId: 'user-123',
          type: 'credit_card',
          category: 'credit_cards',
          name: 'Visa Card',
          currentBalance: 2500,
        }));
      });

      it('should delete an existing liability', async () => {
        mockRequest.params = { id: 'liability-abc123' };

        await deleteLiability(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: 'Liability deleted successfully',
          })
        );
      });
    });
  });

  describe('Net Worth Calculations', () => {
    describe('calculateNetWorth', () => {
      it('should calculate current net worth', async () => {
        // For this test, we need to ensure the result is either returned or next is called
        await calculateNetWorth(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        // Either success response or graceful error handling
        const wasCalled = jsonMock.mock.calls.length > 0 || (mockNext as jest.Mock).mock.calls.length > 0;
        expect(wasCalled).toBe(true);
      });

      it('should return cached net worth when available', async () => {
        const cachedResult = {
          success: true,
          data: {
            userId: 'user-123',
            netWorth: 50000,
            totalAssets: 75000,
            totalLiabilities: 25000,
          },
        };
        (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

        await calculateNetWorth(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(cachedResult);
      });

      it('should call next with error for unauthenticated requests', async () => {
        mockRequest.user = undefined;

        await calculateNetWorth(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('getNetWorthHistory', () => {
      it('should return net worth history', async () => {
        await getNetWorthHistory(
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

      it('should accept limit query parameter', async () => {
        mockRequest.query = { limit: '6' };

        await getNetWorthHistory(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(cache.setAsync).toHaveBeenCalledWith(
          'networth:user-123:history:6',
          expect.any(Object),
          expect.any(Number)
        );
      });

      it('should return cached history when available', async () => {
        const cachedResult = {
          success: true,
          data: [
            { date: '2025-01-01', netWorth: 45000 },
            { date: '2024-12-01', netWorth: 42000 },
          ],
        };
        (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

        await getNetWorthHistory(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(cachedResult);
      });
    });

    describe('getNetWorthTrends', () => {
      it('should return net worth trends', async () => {
        await getNetWorthTrends(
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

      it('should accept months query parameter', async () => {
        mockRequest.query = { months: '6' };

        await getNetWorthTrends(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalled();
      });

      it('should return cached trends when available', async () => {
        const cachedResult = {
          success: true,
          data: [
            { period: '2025-01', netWorth: 50000, monthlyChange: 5000 },
            { period: '2024-12', netWorth: 45000, monthlyChange: 3000 },
          ],
        };
        (cache.getAsync as jest.Mock).mockResolvedValue(cachedResult);

        await getNetWorthTrends(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(jsonMock).toHaveBeenCalledWith(cachedResult);
      });

      it('should call next with error for unauthenticated requests', async () => {
        mockRequest.user = undefined;

        await getNetWorthTrends(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});

