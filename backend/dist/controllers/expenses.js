"use strict";
/**
 * Expenses Controller
 *
 * Handles CRUD operations for user expenses with proper authorization,
 * validation, caching, and error handling. Supports cursor-based pagination
 * for efficient data retrieval.
 *
 * @module controllers/expenses
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
exports.getExpenseAnalytics = exports.deleteExpense = exports.updateExpense = exports.createExpense = exports.getExpenseById = exports.getAllExpenses = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importStar(require("../utils/cache"));
/** Default page size for pagination */
const DEFAULT_PAGE_SIZE = 50;
/** Maximum page size for pagination */
const MAX_PAGE_SIZE = 100;
/**
 * Build cache key for expense queries
 */
function buildExpensesCacheKey(userId, params) {
    return `expenses:${userId}:${params.limit}:${params.cursor || 'start'}:${params.sortBy}:${params.sortOrder}:${params.category || ''}:${params.startDate || ''}:${params.endDate || ''}`;
}
/**
 * Build cache key for single expense
 */
function buildExpenseCacheKey(expenseId) {
    return `expense:${expenseId}`;
}
/**
 * Get all expenses for authenticated user with cursor-based pagination
 *
 * @description Fetches expenses with pagination support for efficient data retrieval.
 * Uses cursor-based pagination to handle large datasets without offset issues.
 * Results are cached in distributed cache for 30 seconds.
 *
 * @param req - Express request with authenticated user
 * @param req.query.limit - Number of items to return (1-100, default: 50)
 * @param req.query.cursor - Document ID to start after (for pagination)
 * @param req.query.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
 * @param req.query.sortBy - Field to sort by: 'date', 'createdAt', 'amount', 'name' (default: 'date')
 * @param req.query.category - Filter by category (optional)
 * @param req.query.startDate - Filter by start date ISO format (optional)
 * @param req.query.endDate - Filter by end date ISO format (optional)
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Paginated array of user expenses with metadata
 *
 * @example
 * GET /api/expenses?limit=20&cursor=abc123&sortOrder=desc
 * Response: {
 *   data: [{ id, name, amount, ... }],
 *   pagination: { count: 20, limit: 20, nextCursor: 'xyz789', hasMore: true }
 * }
 */
const getAllExpenses = async (req, res, next) => {
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
        const sortOrderParam = req.query.sortOrder;
        const sortBy = req.query.sortBy || 'date';
        // Validate sortOrder - cast only after validation
        const validSortOrders = ['asc', 'desc'];
        if (sortOrderParam && !validSortOrders.includes(sortOrderParam)) {
            throw new errorHandler_1.AppError(`Invalid sortOrder. Allowed: ${validSortOrders.join(', ')}`, 400, true);
        }
        const sortOrder = sortOrderParam || 'desc';
        // Validate sortBy against allowed fields to prevent injection
        const allowedSortFields = ['date', 'createdAt', 'amount', 'name', 'category'];
        if (!allowedSortFields.includes(sortBy)) {
            throw new errorHandler_1.AppError(`Invalid sortBy field. Allowed: ${allowedSortFields.join(', ')}`, 400, true);
        }
        // Parse filter parameters
        const category = req.query.category;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        // Build cache key
        const cacheKey = buildExpensesCacheKey(userId, {
            limit, cursor, sortBy, sortOrder, category, startDate, endDate
        });
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.status(200).json(cachedResult);
            return;
        }
        // Build query with filters
        let query = firebase_1.db.collection('expenses')
            .where('userId', '==', userId);
        // Apply category filter
        if (category) {
            query = query.where('category', '==', category);
        }
        // Apply date range filters
        if (startDate) {
            query = query.where('date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('date', '<=', endDate);
        }
        // Apply sorting - Firestore requires first orderBy to match inequality filter field
        // When date filters are used, we must order by date first
        if ((startDate || endDate) && sortBy !== 'date') {
            // Primary sort by date (required for inequality), secondary sort by requested field
            query = query.orderBy('date', sortOrder).orderBy(sortBy, sortOrder);
        }
        else {
            query = query.orderBy(sortBy, sortOrder);
        }
        // Apply cursor for pagination with ownership verification
        if (cursor) {
            try {
                const cursorDoc = await firebase_1.db.collection('expenses').doc(cursor).get();
                // Verify cursor exists AND belongs to requesting user to prevent enumeration attacks
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
        const expensesSnapshot = await query.limit(limit + 1).get();
        const allDocs = expensesSnapshot.docs;
        const hasMore = allDocs.length > limit;
        const docs = hasMore ? allDocs.slice(0, limit) : allDocs;
        const expenses = docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Determine next cursor
        const nextCursor = hasMore && docs.length > 0
            ? docs[docs.length - 1].id
            : null;
        const pagination = {
            count: expenses.length,
            limit,
            nextCursor,
            hasMore
        };
        const result = { success: true, data: expenses, pagination };
        // Cache results in distributed cache
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in getAllExpenses', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch expenses', 500, false));
    }
};
exports.getAllExpenses = getAllExpenses;
/**
 * Get a specific expense by ID
 *
 * @param req - Express request with expense ID in params
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Single expense object
 *
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Expense not found
 */
const getExpenseById = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const expenseId = req.params.id;
        const cacheKey = buildExpenseCacheKey(expenseId);
        // Try distributed cache first
        const cachedExpense = await cache_1.default.getAsync(cacheKey);
        if (cachedExpense) {
            // Verify ownership from cached data
            if (cachedExpense.data.userId !== req.user.uid) {
                throw new errorHandler_1.AppError('Forbidden: You do not have access to this expense', 403, true);
            }
            res.status(200).json(cachedExpense);
            return;
        }
        const expenseDoc = await firebase_1.db.collection('expenses').doc(expenseId).get();
        if (!expenseDoc.exists) {
            throw new errorHandler_1.AppError('Expense not found', 404, true);
        }
        const expenseData = expenseDoc.data();
        if (!expenseData) {
            throw new errorHandler_1.AppError('Expense data is missing', 404, true);
        }
        // Verify ownership
        if (expenseData.userId !== req.user.uid) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this expense', 403, true);
        }
        const expense = {
            id: expenseDoc.id,
            ...expenseData
        };
        const result = { success: true, data: expense };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.SINGLE_ITEM);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in getExpenseById', {
            error: error instanceof Error ? error.message : 'Unknown error',
            expenseId: req.params.id,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch expense', 500, false));
    }
};
exports.getExpenseById = getExpenseById;
/**
 * Create a new expense
 *
 * @description Creates an expense and invalidates the user's expense cache.
 *
 * @param req - Express request with expense data in body
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Created expense with ID
 *
 * @throws {AppError} 400 - Missing required fields
 * @throws {AppError} 401 - Unauthorized
 */
const createExpense = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const { name, amount, date, category, description, tags, receiptImageUrl, receiptData } = req.body;
        // Validation (supplementary to Joi schema)
        if (!name || amount === undefined || !date || !category) {
            throw new errorHandler_1.AppError('Missing required fields: name, amount, date, and category are required', 400, true);
        }
        const expenseData = {
            userId: req.user.uid,
            name,
            amount: Number(amount),
            date,
            category,
            description: description || '',
            tags: tags || [],
            createdAt: new Date().toISOString(),
        };
        // Add optional receipt fields if provided
        const fullExpenseData = {
            ...expenseData,
            ...(receiptImageUrl && { receiptImageUrl }),
            ...(receiptData && { receiptData })
        };
        const expenseRef = await firebase_1.db.collection('expenses').add(fullExpenseData);
        // Invalidate all cached expense pages for this user
        await cache_1.default.invalidatePatternAsync(`expenses:${req.user.uid}:*`);
        res.status(201).json({
            success: true,
            data: {
                id: expenseRef.id,
                ...fullExpenseData
            },
            message: 'Expense created successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in createExpense', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to create expense', 500, false));
    }
};
exports.createExpense = createExpense;
/**
 * Update an existing expense
 *
 * @description Updates an expense and invalidates the user's expense cache.
 *
 * @param req - Express request with expense ID in params and update data in body
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Updated expense object
 *
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Expense not found
 */
const updateExpense = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const expenseId = req.params.id;
        const expenseDoc = await firebase_1.db.collection('expenses').doc(expenseId).get();
        if (!expenseDoc.exists) {
            throw new errorHandler_1.AppError('Expense not found', 404, true);
        }
        const expenseData = expenseDoc.data();
        if (!expenseData) {
            throw new errorHandler_1.AppError('Expense data is missing', 404, true);
        }
        // Verify ownership
        if (expenseData.userId !== req.user.uid) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this expense', 403, true);
        }
        const { name, amount, date, category, description, tags, receiptImageUrl, receiptData } = req.body;
        // Build update object with only provided fields (type-safe)
        const updateData = {
            updatedAt: new Date().toISOString()
        };
        if (name !== undefined)
            updateData.name = name;
        if (amount !== undefined)
            updateData.amount = Number(amount);
        if (date !== undefined)
            updateData.date = date;
        if (category !== undefined)
            updateData.category = category;
        if (description !== undefined)
            updateData.description = description;
        if (tags !== undefined)
            updateData.tags = tags;
        if (receiptImageUrl !== undefined)
            updateData.receiptImageUrl = receiptImageUrl;
        if (receiptData !== undefined)
            updateData.receiptData = receiptData;
        await firebase_1.db.collection('expenses').doc(expenseId).update(updateData);
        // Invalidate caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`expenses:${req.user.uid}:*`),
            cache_1.default.delAsync(buildExpenseCacheKey(expenseId))
        ]);
        res.status(200).json({
            success: true,
            data: {
                id: expenseId,
                ...expenseData,
                ...updateData
            },
            message: 'Expense updated successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in updateExpense', {
            error: error instanceof Error ? error.message : 'Unknown error',
            expenseId: req.params.id,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to update expense', 500, false));
    }
};
exports.updateExpense = updateExpense;
/**
 * Delete an expense
 *
 * @description Deletes an expense and invalidates the user's expense cache.
 *
 * @param req - Express request with expense ID in params
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Success message
 *
 * @throws {AppError} 401 - Unauthorized
 * @throws {AppError} 403 - Forbidden (not owner)
 * @throws {AppError} 404 - Expense not found
 */
const deleteExpense = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const expenseId = req.params.id;
        const expenseDoc = await firebase_1.db.collection('expenses').doc(expenseId).get();
        if (!expenseDoc.exists) {
            throw new errorHandler_1.AppError('Expense not found', 404, true);
        }
        const expenseData = expenseDoc.data();
        if (!expenseData) {
            throw new errorHandler_1.AppError('Expense data is missing', 404, true);
        }
        // Verify ownership
        if (expenseData.userId !== req.user.uid) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this expense', 403, true);
        }
        await firebase_1.db.collection('expenses').doc(expenseId).delete();
        // Invalidate caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`expenses:${req.user.uid}:*`),
            cache_1.default.delAsync(buildExpenseCacheKey(expenseId))
        ]);
        res.status(200).json({
            success: true,
            message: 'Expense deleted successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in deleteExpense', {
            error: error instanceof Error ? error.message : 'Unknown error',
            expenseId: req.params.id,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to delete expense', 500, false));
    }
};
exports.deleteExpense = deleteExpense;
/**
 * Get expense analytics and spending insights
 *
 * @description Fetches expense analytics including monthly breakdown,
 * category breakdown, and summary statistics for the specified timeframe.
 * Results are cached in distributed cache for 2 minutes.
 *
 * @param req - Express request with authenticated user and timeframe query
 * @param req.query.timeframe - Timeframe: '3months', '6months', or '12months' (default: '6months')
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Analytics data with monthly breakdown, category breakdown, and summary
 *
 * @throws {AppError} 401 - Unauthorized
 *
 * @example
 * GET /api/expenses/analytics?timeframe=6months
 * Response: {
 *   success: true,
 *   data: {
 *     monthlyData: [{ month: "Nov 2024", amount: 1250.00, count: 45 }],
 *     categoryData: [{ category: "Food", amount: 450.00, count: 20, percentage: 36 }],
 *     summary: { totalExpense: 1250.00, monthlyAverage: 208.33, ... },
 *     timeframe: "6months",
 *     dateRange: { start: "...", end: "..." }
 *   }
 * }
 */
const getExpenseAnalytics = async (req, res, next) => {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userId = req.user.uid;
        const timeframe = req.query.timeframe || '6months';
        // Validate timeframe
        const validTimeframes = ['3months', '6months', '12months'];
        if (!validTimeframes.includes(timeframe)) {
            throw new errorHandler_1.AppError(`Invalid timeframe. Allowed: ${validTimeframes.join(', ')}`, 400, true);
        }
        // Build cache key
        const cacheKey = `expenses:analytics:${userId}:${timeframe}`;
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.status(200).json(cachedResult);
            return;
        }
        // Calculate date range based on timeframe
        const endDate = new Date();
        const startDate = new Date();
        switch (timeframe) {
            case '3months':
                startDate.setMonth(endDate.getMonth() - 3);
                break;
            case '6months':
                startDate.setMonth(endDate.getMonth() - 6);
                break;
            case '12months':
                startDate.setMonth(endDate.getMonth() - 12);
                break;
        }
        // Set to start of day and end of day
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        // Fetch all expenses in the date range
        const expensesSnapshot = await firebase_1.db.collection('expenses')
            .where('userId', '==', userId)
            .where('date', '>=', startDateStr)
            .where('date', '<=', endDateStr)
            .orderBy('date', 'desc')
            .get();
        const expenses = expensesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Calculate monthly data
        const monthlyMap = new Map();
        expenses.forEach(expense => {
            const expenseDate = new Date(expense.date);
            const monthKey = expenseDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const sortKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
            const existing = monthlyMap.get(monthKey);
            if (existing) {
                existing.amount += expense.amount;
                existing.count += 1;
            }
            else {
                monthlyMap.set(monthKey, {
                    amount: expense.amount,
                    count: 1,
                    sortKey
                });
            }
        });
        const monthlyData = Array.from(monthlyMap.entries())
            .map(([month, data]) => ({ month, amount: data.amount, count: data.count, sortKey: data.sortKey }))
            .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
            .map(({ sortKey: _sortKey, ...rest }) => rest);
        // Calculate category data
        const categoryMap = new Map();
        let totalExpense = 0;
        expenses.forEach(expense => {
            const existing = categoryMap.get(expense.category) || { amount: 0, count: 0 };
            categoryMap.set(expense.category, {
                amount: existing.amount + expense.amount,
                count: existing.count + 1
            });
            totalExpense += expense.amount;
        });
        const categoryData = Array.from(categoryMap.entries())
            .map(([category, data]) => ({
            category,
            amount: data.amount,
            count: data.count,
            percentage: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0
        }))
            .sort((a, b) => b.amount - a.amount);
        // Calculate summary statistics
        const totalTransactions = expenses.length;
        const numberOfMonths = monthlyData.length || 1;
        const monthlyAverage = totalExpense / numberOfMonths;
        const highestCategory = categoryData.length > 0
            ? categoryData[0].category
            : 'N/A';
        const highestCategoryAmount = categoryData.length > 0
            ? categoryData[0].amount
            : 0;
        const result = {
            success: true,
            data: {
                monthlyData,
                categoryData,
                summary: {
                    totalExpense,
                    monthlyAverage: Math.round(monthlyAverage * 100) / 100,
                    totalTransactions,
                    highestCategory,
                    highestCategoryAmount
                },
                timeframe,
                dateRange: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString()
                }
            }
        };
        // Cache results in distributed cache (2 minutes cache for analytics)
        await cache_1.default.setAsync(cacheKey, result, 2 * 60);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error in getExpenseAnalytics', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid,
            timeframe: req.query.timeframe
        });
        next(new errorHandler_1.AppError('Failed to fetch expense analytics', 500, false));
    }
};
exports.getExpenseAnalytics = getExpenseAnalytics;
