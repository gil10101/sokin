"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const firebase_1 = require("../config/firebase");
const logger_1 = __importDefault(require("../utils/logger"));
const redisCache_1 = require("../utils/redisCache");
class DashboardController {
    static async getDashboard(req, res) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const cacheKey = `dashboard:${userId}`;
            const cached = await (0, redisCache_1.cacheGet)(cacheKey);
            if (cached) {
                return res.json(cached);
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const [expensesSnap, budgetsSnap, notificationsSnap] = await Promise.all([
                firebase_1.db
                    .collection('expenses')
                    .where('userId', '==', userId)
                    .orderBy('date', 'desc')
                    .limit(50) // Reduced from 100 to 50 for faster loading
                    .get(),
                firebase_1.db
                    .collection('budgets')
                    .where('userId', '==', userId)
                    .limit(20) // Add limit for budgets
                    .get(),
                firebase_1.db
                    .collection('notifications')
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'desc')
                    .limit(5) // Reduced from 10 to 5 notifications
                    .get(),
            ]);
            const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const budgets = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const notifications = notificationsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const payload = { expenses, budgets, notifications };
            await (0, redisCache_1.cacheSet)(cacheKey, payload, 600); // Cache for 10 minutes instead of 5
            return res.json(payload);
        }
        catch (e) {
            logger_1.default.error('Dashboard endpoint error', { error: e.message });
            return res.status(500).json({ error: 'Failed to load dashboard data' });
        }
    }
}
exports.DashboardController = DashboardController;
