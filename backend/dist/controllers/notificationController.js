"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const firebase_1 = require("../config/firebase");
const messaging_1 = require("firebase-admin/messaging");
class NotificationController {
    // Get user notifications
    static async getUserNotifications(req, res) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const notificationsRef = firebase_1.db.collection('notifications');
            const q = notificationsRef.where('userId', '==', userId);
            const snapshot = await q.get();
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json({ notifications });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch notifications' });
        }
    }
    // Mark notification as read
    static async markAsRead(req, res) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { notificationId } = req.params;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            await firebase_1.db.doc(`notifications/${notificationId}`).update({
                read: true,
                updatedAt: new Date().toISOString()
            });
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update notification' });
        }
    }
    // Update notification preferences
    static async updatePreferences(req, res) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const preferences = {
                userId,
                budgetAlerts: (_b = req.body.budgetAlerts) !== null && _b !== void 0 ? _b : true,
                billReminders: (_c = req.body.billReminders) !== null && _c !== void 0 ? _c : true,
                goalMilestones: (_d = req.body.goalMilestones) !== null && _d !== void 0 ? _d : true,
                spendingInsights: (_e = req.body.spendingInsights) !== null && _e !== void 0 ? _e : true,
                pushNotifications: (_f = req.body.pushNotifications) !== null && _f !== void 0 ? _f : true,
                emailNotifications: (_g = req.body.emailNotifications) !== null && _g !== void 0 ? _g : false,
                budgetWarningThreshold: (_h = req.body.budgetWarningThreshold) !== null && _h !== void 0 ? _h : 80,
                budgetExceededThreshold: (_j = req.body.budgetExceededThreshold) !== null && _j !== void 0 ? _j : 100,
                reminderDaysBefore: (_k = req.body.reminderDaysBefore) !== null && _k !== void 0 ? _k : 3
            };
            await firebase_1.db.doc(`users/${userId}`).update({
                notificationPreferences: preferences,
                updatedAt: new Date().toISOString()
            });
            res.json({ preferences });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update preferences' });
        }
    }
    // Register FCM token for push notifications
    static async registerFCMToken(req, res) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { token } = req.body;
            if (!userId || !token) {
                return res.status(400).json({ error: 'User ID and token required' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const userRef = firebase_1.db.doc(`users/${userId}`);
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const existingTokens = (userData === null || userData === void 0 ? void 0 : userData.fcmTokens) || [];
                if (!existingTokens.includes(token)) {
                    await userRef.update({
                        fcmTokens: [...existingTokens, token],
                        updatedAt: new Date().toISOString()
                    });
                }
            }
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to register token' });
        }
    }
    // Check budget alerts (called by scheduled Cloud Function)
    static async checkBudgetAlerts(req, res) {
        try {
            const { userId } = req.body;
            if (!userId) {
                return res.status(400).json({ error: 'User ID required' });
            }
            const alerts = await NotificationController.generateBudgetAlerts(userId);
            res.json({ alerts });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to check budget alerts' });
        }
    }
    // Generate budget alerts based on current spending
    static async generateBudgetAlerts(userId) {
        const alerts = [];
        try {
            if (!firebase_1.db) {
                return alerts;
            }
            // Get user's active budgets
            const budgetsRef = firebase_1.db.collection('budgets');
            const budgetsQuery = budgetsRef.where('userId', '==', userId);
            const budgetsSnapshot = await budgetsQuery.get();
            for (const budgetDoc of budgetsSnapshot.docs) {
                const budget = { id: budgetDoc.id, ...budgetDoc.data() };
                if (!budget.isActive)
                    continue;
                // Calculate current spending for this budget
                const currentSpent = await NotificationController.calculateBudgetSpending(userId, budget);
                const spentPercentage = (currentSpent / budget.amount) * 100;
                // Check alert thresholds
                const thresholds = budget.alertThresholds || [
                    { percentage: 80, type: 'warning', notified: false },
                    { percentage: 100, type: 'exceeded', notified: false }
                ];
                for (const threshold of thresholds) {
                    if (spentPercentage >= threshold.percentage && !threshold.notified) {
                        const alert = {
                            userId,
                            type: threshold.type === 'exceeded' ? 'budget_exceeded' : 'budget_warning',
                            title: threshold.type === 'exceeded' ? 'Budget Exceeded!' : 'Budget Warning',
                            message: `You've spent ${spentPercentage.toFixed(1)}% of your "${budget.name}" budget ($${currentSpent.toFixed(2)} of $${budget.amount.toFixed(2)})`,
                            data: {
                                budgetId: budget.id,
                                currentSpent,
                                budgetAmount: budget.amount,
                                percentage: spentPercentage
                            },
                            read: false,
                            createdAt: new Date().toISOString(),
                            priority: threshold.type === 'exceeded' ? 'high' : 'medium'
                        };
                        // Save notification
                        await firebase_1.db.collection('notifications').add(alert);
                        // Send push notification
                        await NotificationController.sendPushNotification(userId, alert);
                        // Mark threshold as notified
                        threshold.notified = true;
                        alerts.push(alert);
                    }
                }
                // Update budget with current spending and threshold states
                await firebase_1.db.doc(`budgets/${budget.id}`).update({
                    currentSpent,
                    remainingAmount: Math.max(0, budget.amount - currentSpent),
                    alertThresholds: thresholds,
                    updatedAt: new Date().toISOString()
                });
            }
        }
        catch (error) {
        }
        return alerts;
    }
    // Calculate current spending for a budget
    static async calculateBudgetSpending(userId, budget) {
        if (!firebase_1.db) {
            return 0;
        }
        const now = new Date();
        const startDate = new Date(budget.startDate);
        let endDate;
        // Calculate period end date
        switch (budget.period) {
            case 'daily':
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 1);
                break;
            case 'weekly':
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 7);
                break;
            case 'monthly':
                endDate = new Date(startDate);
                endDate.setMonth(startDate.getMonth() + 1);
                break;
            case 'yearly':
                endDate = new Date(startDate);
                endDate.setFullYear(startDate.getFullYear() + 1);
                break;
            default:
                endDate = budget.endDate ? new Date(budget.endDate) : now;
        }
        // Query expenses in budget period and categories
        const expensesRef = firebase_1.db.collection('expenses');
        let expensesQuery = expensesRef
            .where('userId', '==', userId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);
        // Filter by categories if specified
        if (budget.categories && budget.categories.length > 0) {
            expensesQuery = expensesQuery.where('category', 'in', budget.categories);
        }
        const expensesSnapshot = await expensesQuery.get();
        return expensesSnapshot.docs.reduce((total, doc) => {
            const expense = doc.data();
            return total + expense.amount;
        }, 0);
    }
    // Send push notification to user
    static async sendPushNotification(userId, notification) {
        try {
            if (!firebase_1.db) {
                return;
            }
            const userDoc = await firebase_1.db.doc(`users/${userId}`).get();
            if (!userDoc.exists)
                return;
            const userData = userDoc.data();
            const fcmTokens = (userData === null || userData === void 0 ? void 0 : userData.fcmTokens) || [];
            if (fcmTokens.length === 0)
                return;
            const messaging = (0, messaging_1.getMessaging)();
            const message = {
                notification: {
                    title: notification.title,
                    body: notification.message
                },
                data: {
                    type: notification.type,
                    notificationId: notification.id || '',
                    ...notification.data
                },
                tokens: fcmTokens
            };
            const response = await messaging.sendEachForMulticast(message);
            // Remove invalid tokens
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
                var _a;
                if (!resp.success && ((_a = resp.error) === null || _a === void 0 ? void 0 : _a.code) === 'messaging/registration-token-not-registered') {
                    tokensToRemove.push(fcmTokens[idx]);
                }
            });
            if (tokensToRemove.length > 0) {
                const validTokens = fcmTokens.filter((token) => !tokensToRemove.includes(token));
                await firebase_1.db.doc(`users/${userId}`).update({
                    fcmTokens: validTokens
                });
            }
        }
        catch (error) {
        }
    }
}
exports.NotificationController = NotificationController;
