"use strict";
/**
 * Dashboard Controller
 *
 * Provides aggregated dashboard data for the user including recent expenses,
 * active budgets, and unread notifications. Implements distributed caching
 * for performance in serverless environments.
 *
 * @module controllers/dashboardController
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
exports.invalidateDashboardCache = exports.getDashboard = void 0;
const firebase_1 = require("../config/firebase");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importStar(require("../utils/cache"));
const errorHandler_1 = require("../middleware/errorHandler");
/** Maximum number of expenses to return in dashboard */
const MAX_DASHBOARD_EXPENSES = 50;
/** Maximum number of budgets to return in dashboard */
const MAX_DASHBOARD_BUDGETS = 20;
/** Maximum number of notifications to return in dashboard */
const MAX_DASHBOARD_NOTIFICATIONS = 5;
/**
 * Build cache key for dashboard
 */
function buildDashboardCacheKey(userId) {
    return `dashboard:${userId}`;
}
/**
 * Get dashboard summary data for authenticated user
 *
 * @description Fetches recent expenses, budgets, and notifications in parallel.
 * Results are cached in distributed cache for 10 minutes to reduce database load.
 *
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Dashboard payload with expenses, budgets, and notifications
 *
 * @example
 * GET /api/dashboard
 * Response: { success: true, data: { expenses: [...], budgets: [...], notifications: [...] } }
 */
const getDashboard = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        const cacheKey = buildDashboardCacheKey(userId);
        // Try distributed cache first
        const cached = await cache_1.default.getAsync(cacheKey);
        if (cached) {
            res.json({ success: true, data: cached });
            return;
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        // Fetch all dashboard data in parallel for optimal performance
        const [expensesSnap, budgetsSnap, notificationsSnap] = await Promise.all([
            firebase_1.db
                .collection('expenses')
                .where('userId', '==', userId)
                .orderBy('date', 'desc')
                .limit(MAX_DASHBOARD_EXPENSES)
                .get(),
            firebase_1.db
                .collection('budgets')
                .where('userId', '==', userId)
                .limit(MAX_DASHBOARD_BUDGETS)
                .get(),
            firebase_1.db
                .collection('notifications')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(MAX_DASHBOARD_NOTIFICATIONS)
                .get(),
        ]);
        const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const budgets = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const notifications = notificationsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const payload = { expenses, budgets, notifications };
        // Cache in distributed cache for shared access across serverless instances
        // Fire-and-forget to not block the response on cache write failures
        cache_1.default.setAsync(cacheKey, payload, cache_1.CACHE_TTL.DASHBOARD).catch((err) => {
            logger_1.default.warn('Failed to cache dashboard data', {
                error: err instanceof Error ? err.message : 'Unknown error',
                userId
            });
        });
        res.json({ success: true, data: payload });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Dashboard endpoint error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to load dashboard data', 500, false));
    }
};
exports.getDashboard = getDashboard;
/**
 * Invalidate dashboard cache for a user
 *
 * Called when related data (expenses, budgets, notifications) changes.
 *
 * @param userId - User ID whose dashboard cache should be invalidated
 */
const invalidateDashboardCache = async (userId) => {
    try {
        await cache_1.default.delAsync(buildDashboardCacheKey(userId));
        logger_1.default.debug('Dashboard cache invalidated', { userId });
    }
    catch (error) {
        logger_1.default.error('Failed to invalidate dashboard cache', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId
        });
    }
};
exports.invalidateDashboardCache = invalidateDashboardCache;
