/**
 * Net Worth Controller
 * 
 * Handles asset management, liability management, net worth calculations,
 * snapshots, and financial insights with distributed caching.
 * 
 * @module controllers/netWorthController
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache, { CACHE_TTL } from '../utils/cache';
import { 
  Asset, 
  Liability, 
  NetWorthSnapshot, 
  NetWorthCalculation,
  AssetBreakdown, 
  LiabilityBreakdown,
  CreateAssetRequest,
  UpdateAssetRequest,
  CreateLiabilityRequest,
  UpdateLiabilityRequest,
  NetWorthTrend,
  NetWorthInsight
} from '../models/types';

/**
 * Cache key builders
 */
function buildAssetsCacheKey(userId: string): string {
  return `assets:${userId}:list`;
}

function buildAssetCacheKey(assetId: string): string {
  return `asset:${assetId}`;
}

function buildLiabilitiesCacheKey(userId: string): string {
  return `liabilities:${userId}:list`;
}

function buildLiabilityCacheKey(liabilityId: string): string {
  return `liability:${liabilityId}`;
}

function buildNetWorthCacheKey(userId: string): string {
  return `networth:${userId}`;
}

function buildNetWorthHistoryCacheKey(userId: string, limit: number): string {
  return `networth:${userId}:history:${limit}`;
}

function buildNetWorthTrendsCacheKey(userId: string, months: number): string {
  return `networth:${userId}:trends:${months}`;
}

/**
 * Invalidate all net worth related caches for a user
 */
async function invalidateNetWorthCaches(userId: string): Promise<void> {
  await Promise.all([
    cache.invalidatePatternAsync(`assets:${userId}:*`),
    cache.invalidatePatternAsync(`liabilities:${userId}:*`),
    cache.invalidatePatternAsync(`networth:${userId}*`)
  ]);
}

/**
 * Asset Management Controllers
 */

/**
 * Get all assets for a user
 */
export const getUserAssets = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const cacheKey = buildAssetsCacheKey(userId);
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: Asset[] }>(cacheKey);
    if (cachedResult) {
      res.json(cachedResult);
      return;
    }

    const assetsRef = db.collection('assets');
    const snapshot = await assetsRef
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const assets: Asset[] = [];
    snapshot.forEach(doc => {
      assets.push({ id: doc.id, ...doc.data() } as Asset);
    });

    const result = { success: true, data: assets };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching assets', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to fetch assets', 500, false));
  }
};

/**
 * Create a new asset
 */
export const createAsset = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const assetData: CreateAssetRequest = req.body;
    const now = new Date().toISOString();

    const newAsset: Omit<Asset, 'id'> = {
      userId,
      type: assetData.type,
      category: assetData.category,
      name: assetData.name,
      currentValue: assetData.currentValue,
      description: assetData.description,
      metadata: assetData.metadata,
      lastUpdated: now,
      createdAt: now,
    };

    const docRef = await db.collection('assets').add(newAsset);
    const createdAsset = { id: docRef.id, ...newAsset };

    // Invalidate caches and trigger net worth recalculation
    await invalidateNetWorthCaches(userId);
    await updateNetWorthSnapshot(userId);

    res.status(201).json({ success: true, data: createdAsset, message: 'Asset created successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error creating asset', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to create asset', 500, false));
  }
};

/**
 * Update an asset
 */
export const updateAsset = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const assetId = req.params.id;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const assetRef = db.collection('assets').doc(assetId);
    const assetDoc = await assetRef.get();

    if (!assetDoc.exists) {
      throw new AppError('Asset not found', 404, true);
    }

    const assetData = assetDoc.data() as Asset;
    if (assetData.userId !== userId) {
      throw new AppError('Forbidden: Not your asset', 403, true);
    }

    const updateData: UpdateAssetRequest = req.body;
    const now = new Date().toISOString();

    const updatedFields = {
      ...updateData,
      lastUpdated: now,
      updatedAt: now,
    };

    await assetRef.update(updatedFields);

    // Invalidate caches and trigger net worth recalculation
    await Promise.all([
      invalidateNetWorthCaches(userId),
      cache.delAsync(buildAssetCacheKey(assetId))
    ]);
    await updateNetWorthSnapshot(userId);

    const updatedAsset = { id: assetId, ...assetData, ...updatedFields };
    res.json({ success: true, data: updatedAsset, message: 'Asset updated successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error updating asset', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to update asset', 500, false));
  }
};

/**
 * Delete an asset
 */
export const deleteAsset = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const assetId = req.params.id;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const assetRef = db.collection('assets').doc(assetId);
    const assetDoc = await assetRef.get();

    if (!assetDoc.exists) {
      throw new AppError('Asset not found', 404, true);
    }

    const assetData = assetDoc.data() as Asset;
    if (assetData.userId !== userId) {
      throw new AppError('Forbidden: Not your asset', 403, true);
    }

    await assetRef.delete();

    // Invalidate caches and trigger net worth recalculation
    await Promise.all([
      invalidateNetWorthCaches(userId),
      cache.delAsync(buildAssetCacheKey(assetId))
    ]);
    await updateNetWorthSnapshot(userId);

    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error deleting asset', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to delete asset', 500, false));
  }
};

/**
 * Liability Management Controllers
 */

/**
 * Get all liabilities for a user
 */
export const getUserLiabilities = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const cacheKey = buildLiabilitiesCacheKey(userId);
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: Liability[] }>(cacheKey);
    if (cachedResult) {
      res.json(cachedResult);
      return;
    }

    const liabilitiesRef = db.collection('liabilities');
    const snapshot = await liabilitiesRef
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const liabilities: Liability[] = [];
    snapshot.forEach(doc => {
      liabilities.push({ id: doc.id, ...doc.data() } as Liability);
    });

    const result = { success: true, data: liabilities };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);

    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching liabilities', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to fetch liabilities', 500, false));
  }
};

/**
 * Create a new liability
 */
export const createLiability = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const liabilityData: CreateLiabilityRequest = req.body;
    const now = new Date().toISOString();

    const newLiability: Omit<Liability, 'id'> = {
      userId,
      type: liabilityData.type,
      category: liabilityData.category,
      name: liabilityData.name,
      currentBalance: liabilityData.currentBalance,
      originalAmount: liabilityData.originalAmount,
      interestRate: liabilityData.interestRate,
      minimumPayment: liabilityData.minimumPayment,
      dueDate: liabilityData.dueDate,
      metadata: liabilityData.metadata,
      createdAt: now,
    };

    const docRef = await db.collection('liabilities').add(newLiability);
    const createdLiability = { id: docRef.id, ...newLiability };

    // Invalidate caches and trigger net worth recalculation
    await invalidateNetWorthCaches(userId);
    await updateNetWorthSnapshot(userId);

    res.status(201).json({ success: true, data: createdLiability, message: 'Liability created successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error creating liability', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to create liability', 500, false));
  }
};

/**
 * Update a liability
 */
export const updateLiability = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const liabilityId = req.params.id;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const liabilityRef = db.collection('liabilities').doc(liabilityId);
    const liabilityDoc = await liabilityRef.get();

    if (!liabilityDoc.exists) {
      throw new AppError('Liability not found', 404, true);
    }

    const liabilityData = liabilityDoc.data() as Liability;
    if (liabilityData.userId !== userId) {
      throw new AppError('Forbidden: Not your liability', 403, true);
    }

    const updateData: UpdateLiabilityRequest = req.body;
    const now = new Date().toISOString();

    const updatedFields = {
      ...updateData,
      updatedAt: now,
    };

    await liabilityRef.update(updatedFields);

    // Invalidate caches and trigger net worth recalculation
    await Promise.all([
      invalidateNetWorthCaches(userId),
      cache.delAsync(buildLiabilityCacheKey(liabilityId))
    ]);
    await updateNetWorthSnapshot(userId);

    const updatedLiability = { id: liabilityId, ...liabilityData, ...updatedFields };
    res.json({ success: true, data: updatedLiability, message: 'Liability updated successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error updating liability', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to update liability', 500, false));
  }
};

/**
 * Delete a liability
 */
export const deleteLiability = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const liabilityId = req.params.id;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const liabilityRef = db.collection('liabilities').doc(liabilityId);
    const liabilityDoc = await liabilityRef.get();

    if (!liabilityDoc.exists) {
      throw new AppError('Liability not found', 404, true);
    }

    const liabilityData = liabilityDoc.data() as Liability;
    if (liabilityData.userId !== userId) {
      throw new AppError('Forbidden: Not your liability', 403, true);
    }

    await liabilityRef.delete();

    // Invalidate caches and trigger net worth recalculation
    await Promise.all([
      invalidateNetWorthCaches(userId),
      cache.delAsync(buildLiabilityCacheKey(liabilityId))
    ]);
    await updateNetWorthSnapshot(userId);

    res.json({ success: true, message: 'Liability deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error deleting liability', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to delete liability', 500, false));
  }
};

/**
 * Net Worth Calculation and Snapshot Controllers
 */

/**
 * Calculate current net worth
 */
export const calculateNetWorth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    const cacheKey = buildNetWorthCacheKey(userId);
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: NetWorthCalculation }>(cacheKey);
    if (cachedResult) {
      res.json(cachedResult);
      return;
    }

    if (!db) {
      // Return empty calculation for development mode
      const emptyCalculation: NetWorthCalculation = {
        userId,
        calculatedAt: new Date().toISOString(),
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        assetBreakdown: {
          bankAccounts: 0,
          investmentAccounts: 0,
          realEstate: 0,
          vehicles: 0,
          otherValuables: 0,
        },
        liabilityBreakdown: {
          creditCards: 0,
          mortgages: 0,
          studentLoans: 0,
          autoLoans: 0,
          personalLoans: 0,
          otherDebts: 0,
        },
        assets: [],
        liabilities: [],
        monthlyChange: 0,
        monthlyChangePercent: 0,
      };
      res.json({ success: true, data: emptyCalculation });
      return;
    }

    const calculation = await calculateUserNetWorth(userId);
    const result = { success: true, data: calculation };
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.SINGLE_ITEM);
    
    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error calculating net worth', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to calculate net worth', 500, false));
  }
};

/**
 * Get net worth history/snapshots
 */
export const getNetWorthHistory = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 12), 60); // Default 12 months, clamped 1-60
    const cacheKey = buildNetWorthHistoryCacheKey(userId, limit);
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: NetWorthSnapshot[] }>(cacheKey);
    if (cachedResult) {
      res.json(cachedResult);
      return;
    }
    
    const snapshotsRef = db.collection('netWorthSnapshots');
    const snapshot = await snapshotsRef
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    const snapshots: NetWorthSnapshot[] = [];
    snapshot.forEach(doc => {
      snapshots.push({ id: doc.id, ...doc.data() } as NetWorthSnapshot);
    });

    const result = { success: true, data: snapshots.reverse() }; // Return in chronological order
    
    // Cache the result
    await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);
    
    res.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching net worth history', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to fetch net worth history', 500, false));
  }
};

/**
 * Get net worth trends
 */
export const getNetWorthTrends = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      // Return empty trends for development mode
      res.json({ success: true, data: [] });
      return;
    }

    const months = Math.min(Math.max(1, parseInt(req.query.months as string) || 12), 60);
    const cacheKey = buildNetWorthTrendsCacheKey(userId, months);
    
    // Try distributed cache first
    const cachedResult = await cache.getAsync<{ success: boolean; data: NetWorthTrend[] }>(cacheKey);
    if (cachedResult) {
      res.json(cachedResult);
      return;
    }
    
    try {
      const snapshotsRef = db.collection('netWorthSnapshots');
      
      const snapshot = await snapshotsRef
        .where('userId', '==', userId)
        .orderBy('date', 'desc')
        .limit(months)
        .get();

      const snapshots: NetWorthSnapshot[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as NetWorthSnapshot;
        snapshots.push(data);
      });

      if (snapshots.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }

      snapshots.reverse(); // Chronological order

      const trends: NetWorthTrend[] = snapshots.map((snap, index) => {
          const prevSnap = index > 0 ? snapshots[index - 1] : null;
          const monthlyChange = prevSnap ? snap.netWorth - prevSnap.netWorth : 0;
          const monthlyChangePercent = prevSnap && prevSnap.netWorth !== 0 
            ? (monthlyChange / Math.abs(prevSnap.netWorth)) * 100 
            : 0;

          // Ensure date is a string and extract period
          const period = snap.date.substring(0, 7); // YYYY-MM format

          return {
            period,
            netWorth: snap.netWorth,
            totalAssets: snap.totalAssets,
            totalLiabilities: snap.totalLiabilities,
            monthlyChange,
            monthlyChangePercent,
          };
      });

      const result = { success: true, data: trends };
      
      // Cache the result
      await cache.setAsync(cacheKey, result, CACHE_TTL.LIST_QUERY);
      
      res.json(result);
      
    } catch (queryError) {
      const error = queryError as Error;
      
      // If it's a missing index error, return empty data
      if (error.message && error.message.includes('index')) {
        res.json({ success: true, data: [] });
        return;
      }
      
      throw queryError;
    }
    
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching net worth trends', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to fetch net worth trends', 500, false));
  }
};

/**
 * Get net worth insights
 */
export const getNetWorthInsights = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const calculation = await calculateUserNetWorth(userId);
    const insights = generateNetWorthInsights(calculation);

    res.json({ success: true, data: insights });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error generating insights', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to generate insights', 500, false));
  }
};

/**
 * Helper Functions
 */

/**
 * Calculate user's current net worth
 */
export const calculateUserNetWorth = async (userId: string): Promise<NetWorthCalculation> => {
  if (!db) {
    throw new AppError('Database not initialized', 500, false);
  }

  let assets: Asset[] = [];
  let liabilities: Liability[] = [];

  try {
    // Get all assets
    const assetsSnapshot = await db.collection('assets')
      .where('userId', '==', userId)
      .get();
    
    assetsSnapshot.forEach(doc => {
      assets.push({ id: doc.id, ...doc.data() } as Asset);
    });

    // Get all liabilities
    const liabilitiesSnapshot = await db.collection('liabilities')
      .where('userId', '==', userId)
      .get();
    
    liabilitiesSnapshot.forEach(doc => {
      liabilities.push({ id: doc.id, ...doc.data() } as Liability);
    });

  } catch (error) {
    logger.error('Error fetching user financial data', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    // Continue with empty arrays if database fetch fails
    assets = [];
    liabilities = [];
  }

  // Calculate asset breakdown
  const assetBreakdown: AssetBreakdown = {
    bankAccounts: 0,
    investmentAccounts: 0,
    realEstate: 0,
    vehicles: 0,
    otherValuables: 0,
  };

  assets.forEach(asset => {
    switch (asset.category) {
      case 'bank_accounts':
        assetBreakdown.bankAccounts += asset.currentValue;
        break;
      case 'investment_accounts':
        assetBreakdown.investmentAccounts += asset.currentValue;
        break;
      case 'real_estate':
        assetBreakdown.realEstate += asset.currentValue;
        break;
      case 'vehicles':
        assetBreakdown.vehicles += asset.currentValue;
        break;
      case 'other_valuables':
        assetBreakdown.otherValuables += asset.currentValue;
        break;
    }
  });

  // Calculate liability breakdown
  const liabilityBreakdown: LiabilityBreakdown = {
    creditCards: 0,
    mortgages: 0,
    studentLoans: 0,
    autoLoans: 0,
    personalLoans: 0,
    otherDebts: 0,
  };

  liabilities.forEach(liability => {
    switch (liability.category) {
      case 'credit_cards':
        liabilityBreakdown.creditCards += liability.currentBalance;
        break;
      case 'mortgages':
        liabilityBreakdown.mortgages += liability.currentBalance;
        break;
      case 'student_loans':
        liabilityBreakdown.studentLoans += liability.currentBalance;
        break;
      case 'auto_loans':
        liabilityBreakdown.autoLoans += liability.currentBalance;
        break;
      case 'personal_loans':
        liabilityBreakdown.personalLoans += liability.currentBalance;
        break;
      case 'other_debts':
        liabilityBreakdown.otherDebts += liability.currentBalance;
        break;
    }
  });

  const totalAssets = Object.values(assetBreakdown).reduce((sum, val) => sum + val, 0);
  const totalLiabilities = Object.values(liabilityBreakdown).reduce((sum, val) => sum + val, 0);
  const netWorth = totalAssets - totalLiabilities;

  // Get previous month's net worth for change calculation
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevMonthStr = prevMonth.toISOString().substring(0, 7);
  // Compute the first day of the current month as the upper bound
  const nextMonth = new Date();
  nextMonth.setDate(1); // First day of current month
  const nextMonthStr = nextMonth.toISOString().substring(0, 10);

  const prevSnapshot = await db.collection('netWorthSnapshots')
    .where('userId', '==', userId)
    .where('date', '>=', prevMonthStr)
    .where('date', '<', nextMonthStr)
    .limit(1)
    .get();

  let monthlyChange = 0;
  let monthlyChangePercent = 0;

  if (!prevSnapshot.empty) {
    const prevData = prevSnapshot.docs[0].data() as NetWorthSnapshot;
    monthlyChange = netWorth - prevData.netWorth;
    monthlyChangePercent = prevData.netWorth !== 0 
      ? (monthlyChange / Math.abs(prevData.netWorth)) * 100 
      : 0;
  }

  return {
    userId,
    calculatedAt: new Date().toISOString(),
    totalAssets,
    totalLiabilities,
    netWorth,
    assetBreakdown,
    liabilityBreakdown,
    assets,
    liabilities,
    monthlyChange,
    monthlyChangePercent,
  };
};

/**
 * Update/create monthly net worth snapshot
 */
export const updateNetWorthSnapshot = async (userId: string, precomputed?: NetWorthCalculation): Promise<void> => {
  try {
    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const calculation = precomputed || await calculateUserNetWorth(userId);
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = nextMonthDate.toISOString().substring(0, 10);

    // Check if snapshot exists for current month
    const existingSnapshot = await db.collection('netWorthSnapshots')
      .where('userId', '==', userId)
      .where('date', '>=', currentMonth)
      .where('date', '<', nextMonthStr)
      .limit(1)
      .get();

    const snapshotData: Omit<NetWorthSnapshot, 'id'> = {
      userId,
      date: now.toISOString().substring(0, 10), // YYYY-MM-DD
      netWorth: calculation.netWorth,
      totalAssets: calculation.totalAssets,
      totalLiabilities: calculation.totalLiabilities,
      assetBreakdown: calculation.assetBreakdown,
      liabilityBreakdown: calculation.liabilityBreakdown,
      createdAt: now.toISOString(),
      metadata: {
        calculationMethod: 'automatic',
        monthlyChange: calculation.monthlyChange,
        monthlyChangePercent: calculation.monthlyChangePercent,
      },
    };

    if (existingSnapshot.empty) {
      // Create new snapshot
      await db.collection('netWorthSnapshots').add(snapshotData);
    } else {
      // Update existing snapshot
      await existingSnapshot.docs[0].ref.update(snapshotData);
    }
  } catch (error) {
    logger.error('Error updating net worth snapshot', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
  }
};

/**
 * Generate insights based on net worth calculation
 */
const generateNetWorthInsights = (calculation: NetWorthCalculation): NetWorthInsight[] => {
  const insights: NetWorthInsight[] = [];

  // Net worth trend insight
  if (calculation.monthlyChange !== undefined) {
    if (calculation.monthlyChange > 0) {
      insights.push({
        type: 'positive',
        title: 'Net Worth Growing',
        description: `Your net worth increased by $${calculation.monthlyChange.toLocaleString()} this month. Keep up the great work!`,
        value: calculation.monthlyChange,
        priority: 'medium',
      });
    } else if (calculation.monthlyChange < -1000) {
      insights.push({
        type: 'warning',
        title: 'Net Worth Declined',
        description: `Your net worth decreased by $${Math.abs(calculation.monthlyChange).toLocaleString()} this month. Consider reviewing your expenses.`,
        value: Math.abs(calculation.monthlyChange),
        priority: 'high',
        actionable: true,
      });
    }
  }

  // Asset allocation insights
  const assetTotal = calculation.totalAssets;
  if (assetTotal > 0) {
    const cashRatio = calculation.assetBreakdown.bankAccounts / assetTotal;
    const investmentRatio = calculation.assetBreakdown.investmentAccounts / assetTotal;

    if (cashRatio > 0.3) {
      insights.push({
        type: 'info',
        title: 'High Cash Allocation',
        description: `${(cashRatio * 100).toFixed(1)}% of your assets are in cash. Consider investing some for long-term growth.`,
        priority: 'medium',
        actionable: true,
      });
    }

    if (investmentRatio < 0.1 && assetTotal > 10000) {
      insights.push({
        type: 'info',
        title: 'Low Investment Allocation',
        description: 'Consider increasing your investment allocation for long-term wealth building.',
        priority: 'medium',
        actionable: true,
      });
    }
  }

  // Debt-to-asset ratio insight
  if (calculation.totalAssets > 0) {
    const debtRatio = calculation.totalLiabilities / calculation.totalAssets;
    if (debtRatio > 0.4) {
      insights.push({
        type: 'warning',
        title: 'High Debt Ratio',
        description: `Your debt represents ${(debtRatio * 100).toFixed(1)}% of your assets. Focus on debt reduction.`,
        priority: 'high',
        actionable: true,
      });
    }
  }

  return insights;
};
