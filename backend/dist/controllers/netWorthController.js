"use strict";
/**
 * Net Worth Controller
 *
 * Handles asset management, liability management, net worth calculations,
 * snapshots, and financial insights with distributed caching.
 *
 * @module controllers/netWorthController
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNetWorthSnapshot = exports.calculateUserNetWorth = exports.getNetWorthInsights = exports.getNetWorthTrends = exports.getNetWorthHistory = exports.calculateNetWorth = exports.deleteLiability = exports.updateLiability = exports.createLiability = exports.getUserLiabilities = exports.deleteAsset = exports.updateAsset = exports.createAsset = exports.getUserAssets = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importStar(require("../utils/cache"));
/**
 * Cache key builders
 */
function buildAssetsCacheKey(userId) {
    return `assets:${userId}:list`;
}
function buildAssetCacheKey(assetId) {
    return `asset:${assetId}`;
}
function buildLiabilitiesCacheKey(userId) {
    return `liabilities:${userId}:list`;
}
function buildLiabilityCacheKey(liabilityId) {
    return `liability:${liabilityId}`;
}
function buildNetWorthCacheKey(userId) {
    return `networth:${userId}`;
}
function buildNetWorthHistoryCacheKey(userId, limit) {
    return `networth:${userId}:history:${limit}`;
}
function buildNetWorthTrendsCacheKey(userId, months) {
    return `networth:${userId}:trends:${months}`;
}
/**
 * Invalidate all net worth related caches for a user
 */
async function invalidateNetWorthCaches(userId) {
    await Promise.all([
        cache_1.default.invalidatePatternAsync(`assets:${userId}:*`),
        cache_1.default.invalidatePatternAsync(`liabilities:${userId}:*`),
        cache_1.default.invalidatePatternAsync(`networth:${userId}*`)
    ]);
}
/**
 * Asset Management Controllers
 */
/**
 * Get all assets for a user
 */
const getUserAssets = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const cacheKey = buildAssetsCacheKey(userId);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        const assetsRef = firebase_1.db.collection('assets');
        const snapshot = await assetsRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const assets = [];
        snapshot.forEach(doc => {
            assets.push({ id: doc.id, ...doc.data() });
        });
        const result = { success: true, data: assets };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching assets', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch assets', 500, false));
    }
};
exports.getUserAssets = getUserAssets;
/**
 * Create a new asset
 */
const createAsset = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const assetData = req.body;
        const now = new Date().toISOString();
        const newAsset = {
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
        const docRef = await firebase_1.db.collection('assets').add(newAsset);
        const createdAsset = { id: docRef.id, ...newAsset };
        // Invalidate caches and trigger net worth recalculation
        await invalidateNetWorthCaches(userId);
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.status(201).json({ success: true, data: createdAsset, message: 'Asset created successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error creating asset', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to create asset', 500, false));
    }
};
exports.createAsset = createAsset;
/**
 * Update an asset
 */
const updateAsset = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const assetId = req.params.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const assetRef = firebase_1.db.collection('assets').doc(assetId);
        const assetDoc = await assetRef.get();
        if (!assetDoc.exists) {
            throw new errorHandler_1.AppError('Asset not found', 404, true);
        }
        const assetData = assetDoc.data();
        if (assetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Not your asset', 403, true);
        }
        const updateData = req.body;
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
            cache_1.default.delAsync(buildAssetCacheKey(assetId))
        ]);
        await (0, exports.updateNetWorthSnapshot)(userId);
        const updatedAsset = { id: assetId, ...assetData, ...updatedFields };
        res.json({ success: true, data: updatedAsset, message: 'Asset updated successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error updating asset', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to update asset', 500, false));
    }
};
exports.updateAsset = updateAsset;
/**
 * Delete an asset
 */
const deleteAsset = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const assetId = req.params.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const assetRef = firebase_1.db.collection('assets').doc(assetId);
        const assetDoc = await assetRef.get();
        if (!assetDoc.exists) {
            throw new errorHandler_1.AppError('Asset not found', 404, true);
        }
        const assetData = assetDoc.data();
        if (assetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Not your asset', 403, true);
        }
        await assetRef.delete();
        // Invalidate caches and trigger net worth recalculation
        await Promise.all([
            invalidateNetWorthCaches(userId),
            cache_1.default.delAsync(buildAssetCacheKey(assetId))
        ]);
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.json({ success: true, message: 'Asset deleted successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error deleting asset', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to delete asset', 500, false));
    }
};
exports.deleteAsset = deleteAsset;
/**
 * Liability Management Controllers
 */
/**
 * Get all liabilities for a user
 */
const getUserLiabilities = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const cacheKey = buildLiabilitiesCacheKey(userId);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        const liabilitiesRef = firebase_1.db.collection('liabilities');
        const snapshot = await liabilitiesRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const liabilities = [];
        snapshot.forEach(doc => {
            liabilities.push({ id: doc.id, ...doc.data() });
        });
        const result = { success: true, data: liabilities };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching liabilities', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch liabilities', 500, false));
    }
};
exports.getUserLiabilities = getUserLiabilities;
/**
 * Create a new liability
 */
const createLiability = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const liabilityData = req.body;
        const now = new Date().toISOString();
        const newLiability = {
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
        const docRef = await firebase_1.db.collection('liabilities').add(newLiability);
        const createdLiability = { id: docRef.id, ...newLiability };
        // Invalidate caches and trigger net worth recalculation
        await invalidateNetWorthCaches(userId);
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.status(201).json({ success: true, data: createdLiability, message: 'Liability created successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error creating liability', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to create liability', 500, false));
    }
};
exports.createLiability = createLiability;
/**
 * Update a liability
 */
const updateLiability = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const liabilityId = req.params.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const liabilityRef = firebase_1.db.collection('liabilities').doc(liabilityId);
        const liabilityDoc = await liabilityRef.get();
        if (!liabilityDoc.exists) {
            throw new errorHandler_1.AppError('Liability not found', 404, true);
        }
        const liabilityData = liabilityDoc.data();
        if (liabilityData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Not your liability', 403, true);
        }
        const updateData = req.body;
        const now = new Date().toISOString();
        const updatedFields = {
            ...updateData,
            updatedAt: now,
        };
        await liabilityRef.update(updatedFields);
        // Invalidate caches and trigger net worth recalculation
        await Promise.all([
            invalidateNetWorthCaches(userId),
            cache_1.default.delAsync(buildLiabilityCacheKey(liabilityId))
        ]);
        await (0, exports.updateNetWorthSnapshot)(userId);
        const updatedLiability = { id: liabilityId, ...liabilityData, ...updatedFields };
        res.json({ success: true, data: updatedLiability, message: 'Liability updated successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error updating liability', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to update liability', 500, false));
    }
};
exports.updateLiability = updateLiability;
/**
 * Delete a liability
 */
const deleteLiability = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const liabilityId = req.params.id;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const liabilityRef = firebase_1.db.collection('liabilities').doc(liabilityId);
        const liabilityDoc = await liabilityRef.get();
        if (!liabilityDoc.exists) {
            throw new errorHandler_1.AppError('Liability not found', 404, true);
        }
        const liabilityData = liabilityDoc.data();
        if (liabilityData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Not your liability', 403, true);
        }
        await liabilityRef.delete();
        // Invalidate caches and trigger net worth recalculation
        await Promise.all([
            invalidateNetWorthCaches(userId),
            cache_1.default.delAsync(buildLiabilityCacheKey(liabilityId))
        ]);
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.json({ success: true, message: 'Liability deleted successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error deleting liability', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to delete liability', 500, false));
    }
};
exports.deleteLiability = deleteLiability;
/**
 * Net Worth Calculation and Snapshot Controllers
 */
/**
 * Calculate current net worth
 */
const calculateNetWorth = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        const cacheKey = buildNetWorthCacheKey(userId);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        if (!firebase_1.db) {
            // Return empty calculation for development mode
            const emptyCalculation = {
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
        const calculation = await (0, exports.calculateUserNetWorth)(userId);
        const result = { success: true, data: calculation };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.SINGLE_ITEM);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error calculating net worth', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to calculate net worth', 500, false));
    }
};
exports.calculateNetWorth = calculateNetWorth;
/**
 * Get net worth history/snapshots
 */
const getNetWorthHistory = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const limit = parseInt(req.query.limit) || 12; // Default 12 months
        const cacheKey = buildNetWorthHistoryCacheKey(userId, limit);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        const snapshotsRef = firebase_1.db.collection('netWorthSnapshots');
        const snapshot = await snapshotsRef
            .where('userId', '==', userId)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        const snapshots = [];
        snapshot.forEach(doc => {
            snapshots.push({ id: doc.id, ...doc.data() });
        });
        const result = { success: true, data: snapshots.reverse() }; // Return in chronological order
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching net worth history', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch net worth history', 500, false));
    }
};
exports.getNetWorthHistory = getNetWorthHistory;
/**
 * Get net worth trends
 */
const getNetWorthTrends = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            // Return empty trends for development mode
            res.json({ success: true, data: [] });
            return;
        }
        const months = parseInt(req.query.months) || 12;
        const cacheKey = buildNetWorthTrendsCacheKey(userId, months);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        try {
            const snapshotsRef = firebase_1.db.collection('netWorthSnapshots');
            const snapshot = await snapshotsRef
                .where('userId', '==', userId)
                .orderBy('date', 'desc')
                .limit(months)
                .get();
            const snapshots = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                snapshots.push(data);
            });
            if (snapshots.length === 0) {
                res.json({ success: true, data: [] });
                return;
            }
            snapshots.reverse(); // Chronological order
            const trends = snapshots.map((snap, index) => {
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
            await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
            res.json(result);
        }
        catch (queryError) {
            const error = queryError;
            // If it's a missing index error, return empty data
            if (error.message && error.message.includes('index')) {
                res.json({ success: true, data: [] });
                return;
            }
            throw queryError;
        }
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching net worth trends', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch net worth trends', 500, false));
    }
};
exports.getNetWorthTrends = getNetWorthTrends;
/**
 * Get net worth insights
 */
const getNetWorthInsights = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const calculation = await (0, exports.calculateUserNetWorth)(userId);
        const insights = generateNetWorthInsights(calculation);
        res.json({ success: true, data: insights });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error generating insights', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to generate insights', 500, false));
    }
};
exports.getNetWorthInsights = getNetWorthInsights;
/**
 * Helper Functions
 */
/**
 * Calculate user's current net worth
 */
const calculateUserNetWorth = async (userId) => {
    if (!firebase_1.db) {
        throw new errorHandler_1.AppError('Database not initialized', 500, false);
    }
    let assets = [];
    let liabilities = [];
    try {
        // Get all assets
        const assetsSnapshot = await firebase_1.db.collection('assets')
            .where('userId', '==', userId)
            .get();
        assetsSnapshot.forEach(doc => {
            assets.push({ id: doc.id, ...doc.data() });
        });
        // Get all liabilities
        const liabilitiesSnapshot = await firebase_1.db.collection('liabilities')
            .where('userId', '==', userId)
            .get();
        liabilitiesSnapshot.forEach(doc => {
            liabilities.push({ id: doc.id, ...doc.data() });
        });
    }
    catch (error) {
        logger_1.default.error('Error fetching user financial data', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId
        });
        // Continue with empty arrays if database fetch fails
        assets = [];
        liabilities = [];
    }
    // Calculate asset breakdown
    const assetBreakdown = {
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
    const liabilityBreakdown = {
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
    const prevSnapshot = await firebase_1.db.collection('netWorthSnapshots')
        .where('userId', '==', userId)
        .where('date', '>=', prevMonthStr)
        .where('date', '<', prevMonthStr + '-32')
        .limit(1)
        .get();
    let monthlyChange = 0;
    let monthlyChangePercent = 0;
    if (!prevSnapshot.empty) {
        const prevData = prevSnapshot.docs[0].data();
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
exports.calculateUserNetWorth = calculateUserNetWorth;
/**
 * Update/create monthly net worth snapshot
 */
const updateNetWorthSnapshot = async (userId) => {
    try {
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const calculation = await (0, exports.calculateUserNetWorth)(userId);
        const now = new Date();
        const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
        // Check if snapshot exists for current month
        const existingSnapshot = await firebase_1.db.collection('netWorthSnapshots')
            .where('userId', '==', userId)
            .where('date', '>=', currentMonth)
            .where('date', '<', currentMonth + '-32')
            .limit(1)
            .get();
        const snapshotData = {
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
            await firebase_1.db.collection('netWorthSnapshots').add(snapshotData);
        }
        else {
            // Update existing snapshot
            await existingSnapshot.docs[0].ref.update(snapshotData);
        }
    }
    catch (error) {
        logger_1.default.error('Error updating net worth snapshot', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId
        });
    }
};
exports.updateNetWorthSnapshot = updateNetWorthSnapshot;
/**
 * Generate insights based on net worth calculation
 */
const generateNetWorthInsights = (calculation) => {
    const insights = [];
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
        }
        else if (calculation.monthlyChange < -1000) {
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
