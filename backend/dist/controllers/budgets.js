"use strict";
/**
 * Budgets Controller
 *
 * Handles CRUD operations for user budgets with caching,
 * authorization, and proper error handling. Supports cursor-based
 * pagination for efficient data retrieval.
 *
 * @module controllers/budgets
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
exports.deleteBudget = exports.updateBudget = exports.createBudget = exports.getBudgetById = exports.getAllBudgets = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importStar(require("../utils/cache"));
/** Default page size for pagination */
const DEFAULT_PAGE_SIZE = 50;
/** Maximum page size for pagination */
const MAX_PAGE_SIZE = 100;
/**
 * Build cache key for budget queries
 */
function buildBudgetsCacheKey(userId, params) {
    return `budgets:${userId}:${params.limit}:${params.cursor || 'start'}:${params.sortBy}:${params.sortOrder}:${params.period || ''}:${params.activeOnly}`;
}
/**
 * Build cache key for single budget
 */
function buildBudgetCacheKey(budgetId) {
    return `budget:${budgetId}`;
}
/**
 * Get all budgets for authenticated user with cursor-based pagination
 *
 * @description Fetches budgets with pagination support for efficient data retrieval.
 * Uses cursor-based pagination to handle large datasets without offset issues.
 * Results are cached in distributed cache for 30 seconds.
 *
 * @param req - Express request with authenticated user
 * @param req.query.limit - Number of items to return (1-100, default: 50)
 * @param req.query.cursor - Document ID to start after (for pagination)
 * @param req.query.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
 * @param req.query.sortBy - Field to sort by: 'createdAt', 'amount', 'name', 'startDate' (default: 'createdAt')
 * @param req.query.period - Filter by period type (optional)
 * @param req.query.activeOnly - Filter active budgets only (default: false)
 * @param res - Express response
 * @param next - Express next function for error propagation
 *
 * @example
 * GET /api/budgets?limit=20&activeOnly=true
 * Response: {
 *   data: [{ id, name, amount, period, ... }],
 *   pagination: { count: 20, limit: 20, nextCursor: 'xyz789', hasMore: true }
 * }
 */
const getAllBudgets = async (req, res, next) => {
    var _a, _b, _c;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userId = req.user.uid;
        // Parse pagination parameters (validated by middleware)
        const limit = Math.min(Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
        const cursor = req.query.cursor;
        const sortOrder = req.query.sortOrder || 'desc';
        const sortBy = req.query.sortBy || 'createdAt';
        // Parse filter parameters
        const period = req.query.period;
        const activeOnly = String(req.query.activeOnly) === 'true';
        // Build cache key
        const cacheKey = buildBudgetsCacheKey(userId, {
            limit, cursor, sortBy, sortOrder, period, activeOnly
        });
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.status(200).json(cachedResult);
            return;
        }
        // Build query with filters
        let query = firebase_1.db.collection('budgets')
            .where('userId', '==', userId);
        // Apply period filter
        if (period) {
            query = query.where('period', '==', period);
        }
        // Apply active filter
        if (activeOnly) {
            query = query.where('isActive', '==', true);
        }
        // Apply sorting
        query = query.orderBy(sortBy, sortOrder);
        // Apply cursor for pagination
        if (cursor) {
            try {
                const cursorDoc = await firebase_1.db.collection('budgets').doc(cursor).get();
                // Verify cursor document exists and belongs to the current user
                if (cursorDoc.exists && ((_b = cursorDoc.data()) === null || _b === void 0 ? void 0 : _b.userId) === userId) {
                    query = query.startAfter(cursorDoc);
                }
                else {
                    throw new errorHandler_1.AppError('Invalid pagination cursor', 400, true);
                }
            }
            catch (error) {
                if (error instanceof errorHandler_1.AppError)
                    throw error;
                throw new errorHandler_1.AppError('Invalid pagination cursor', 400, true);
            }
        }
        // Fetch one extra to determine if there are more results
        const budgetsSnapshot = await query.limit(limit + 1).get();
        const allDocs = budgetsSnapshot.docs;
        const hasMore = allDocs.length > limit;
        const docs = hasMore ? allDocs.slice(0, limit) : allDocs;
        const budgets = docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Determine next cursor
        const nextCursor = hasMore && docs.length > 0
            ? docs[docs.length - 1].id
            : null;
        const pagination = {
            count: budgets.length,
            limit,
            nextCursor,
            hasMore
        };
        const result = { success: true, data: budgets, pagination };
        // Cache results in distributed cache
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in getAllBudgets', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch budgets', 500, false));
    }
};
exports.getAllBudgets = getAllBudgets;
/**
 * Get a specific budget by ID
 *
 * @param req - Express request with budget ID in params
 * @param res - Express response
 * @param next - Express next function for error propagation
 *
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Budget not found
 */
const getBudgetById = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userId = req.user.uid;
        const budgetId = req.params.id;
        const cacheKey = buildBudgetCacheKey(budgetId);
        // Try distributed cache first
        const cachedBudget = await cache_1.default.getAsync(cacheKey);
        if (cachedBudget) {
            // Verify ownership from cached data
            if (cachedBudget.data.userId !== userId) {
                throw new errorHandler_1.AppError('Forbidden: You do not have access to this budget', 403, true);
            }
            res.status(200).json(cachedBudget);
            return;
        }
        const budgetDoc = await firebase_1.db.collection('budgets').doc(budgetId).get();
        if (!budgetDoc.exists) {
            throw new errorHandler_1.AppError('Budget not found', 404, true);
        }
        const budgetData = budgetDoc.data();
        if (!budgetData) {
            throw new errorHandler_1.AppError('Budget data is missing', 404, true);
        }
        // Verify ownership
        if (budgetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this budget', 403, true);
        }
        const budget = {
            id: budgetDoc.id,
            ...budgetData
        };
        const result = { success: true, data: budget };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.SINGLE_ITEM);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in getBudgetById', {
            error: error instanceof Error ? error.message : 'Unknown error',
            budgetId: req.params.id,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch budget', 500, false));
    }
};
exports.getBudgetById = getBudgetById;
/**
 * Create a new budget
 *
 * @description Creates a budget and invalidates the user's budget cache.
 *
 * @param req - Express request with budget data in body
 * @param res - Express response
 * @param next - Express next function for error propagation
 *
 * @throws {AppError} 401 - Unauthorized
 */
const createBudget = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const { name, amount, period, categories, startDate, endDate } = req.body;
        // Validate numeric amount to prevent NaN in database
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            throw new errorHandler_1.AppError('Amount must be a positive number', 400, true);
        }
        const budgetData = {
            userId: req.user.uid,
            name,
            amount: numericAmount,
            period,
            categories: categories || [],
            startDate,
            endDate: endDate || undefined,
            createdAt: new Date().toISOString(),
        };
        const budgetRef = await firebase_1.db.collection('budgets').add(budgetData);
        // Invalidate all cached budget pages for this user
        await cache_1.default.invalidatePatternAsync(`budgets:${req.user.uid}:*`);
        res.status(201).json({
            success: true,
            data: {
                id: budgetRef.id,
                ...budgetData
            },
            message: 'Budget created successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in createBudget', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to create budget', 500, false));
    }
};
exports.createBudget = createBudget;
/**
 * Update an existing budget
 *
 * @description Updates a budget and invalidates the user's budget cache.
 *
 * @param req - Express request with budget ID in params and update data in body
 * @param res - Express response
 * @param next - Express next function for error propagation
 *
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Budget not found
 */
const updateBudget = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userId = req.user.uid;
        const budgetId = req.params.id;
        const budgetDoc = await firebase_1.db.collection('budgets').doc(budgetId).get();
        if (!budgetDoc.exists) {
            throw new errorHandler_1.AppError('Budget not found', 404, true);
        }
        const budgetData = budgetDoc.data();
        if (!budgetData) {
            throw new errorHandler_1.AppError('Budget data is missing', 404, true);
        }
        // Verify ownership
        if (budgetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this budget', 403, true);
        }
        // Build type-safe update object
        const { name, amount, period, categories, startDate, endDate } = req.body;
        const updateData = {
            updatedAt: new Date().toISOString()
        };
        // Validate and assign name
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                throw new errorHandler_1.AppError('Name must be a non-empty string', 400, true);
            }
            updateData.name = name.trim();
        }
        // Validate and assign amount
        if (amount !== undefined) {
            const numericAmount = Number(amount);
            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                throw new errorHandler_1.AppError('Amount must be a positive number', 400, true);
            }
            updateData.amount = numericAmount;
        }
        // Validate and assign period
        if (period !== undefined) {
            const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
            if (!validPeriods.includes(period)) {
                throw new errorHandler_1.AppError(`Period must be one of: ${validPeriods.join(', ')}`, 400, true);
            }
            updateData.period = period;
        }
        if (categories !== undefined)
            updateData.categories = categories;
        if (startDate !== undefined)
            updateData.startDate = startDate;
        if (endDate !== undefined)
            updateData.endDate = endDate;
        await firebase_1.db.collection('budgets').doc(budgetId).update(updateData);
        // Invalidate caches non-blocking to not fail request on cache errors
        Promise.all([
            cache_1.default.invalidatePatternAsync(`budgets:${userId}:*`),
            cache_1.default.delAsync(buildBudgetCacheKey(budgetId))
        ]).catch((err) => {
            logger_1.default.warn('Cache invalidation failed for budget update', {
                budgetId, userId, error: err instanceof Error ? err.message : 'Unknown error'
            });
        });
        res.status(200).json({
            success: true,
            data: {
                id: budgetId,
                ...budgetData,
                ...updateData
            },
            message: 'Budget updated successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in updateBudget', {
            error: error instanceof Error ? error.message : 'Unknown error',
            budgetId: req.params.id,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to update budget', 500, false));
    }
};
exports.updateBudget = updateBudget;
/**
 * Delete a budget
 *
 * @description Deletes a budget and invalidates the user's budget cache.
 *
 * @param req - Express request with budget ID in params
 * @param res - Express response
 * @param next - Express next function for error propagation
 *
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Budget not found
 */
const deleteBudget = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userId = req.user.uid;
        const budgetId = req.params.id;
        const budgetDoc = await firebase_1.db.collection('budgets').doc(budgetId).get();
        if (!budgetDoc.exists) {
            throw new errorHandler_1.AppError('Budget not found', 404, true);
        }
        const budgetData = budgetDoc.data();
        if (!budgetData) {
            throw new errorHandler_1.AppError('Budget data is missing', 404, true);
        }
        // Verify ownership
        if (budgetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this budget', 403, true);
        }
        await firebase_1.db.collection('budgets').doc(budgetId).delete();
        // Invalidate caches non-blocking to not fail request on cache errors
        Promise.all([
            cache_1.default.invalidatePatternAsync(`budgets:${userId}:*`),
            cache_1.default.delAsync(buildBudgetCacheKey(budgetId))
        ]).catch((err) => {
            logger_1.default.warn('Cache invalidation failed for budget delete', {
                budgetId, userId, error: err instanceof Error ? err.message : 'Unknown error'
            });
        });
        res.status(200).json({
            success: true,
            message: 'Budget deleted successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in deleteBudget', {
            error: error instanceof Error ? error.message : 'Unknown error',
            budgetId: req.params.id,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to delete budget', 500, false));
    }
};
exports.deleteBudget = deleteBudget;
