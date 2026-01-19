"use strict";
/**
 * Notification Controller
 *
 * Handles notification management, FCM token registration,
 * budget alerts, and push notification delivery.
 *
 * @module controllers/notificationController
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBudgetAlerts = exports.registerFCMToken = exports.updatePreferences = exports.markAsRead = exports.getUserNotifications = void 0;
const firebase_1 = require("../config/firebase");
const messaging_1 = require("firebase-admin/messaging");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Calculate current spending for a budget
 */
const calculateBudgetSpending = async (userId, budget) => {
    if (!firebase_1.db) {
        throw new errorHandler_1.AppError('Database not initialized', 500, false);
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
    // Firestore 'in' operator has a limit of 10 values, so we need to chunk
    if (budget.categories && budget.categories.length > 0) {
        if (budget.categories.length <= 10) {
            expensesQuery = expensesQuery.where('category', 'in', budget.categories);
            const expensesSnapshot = await expensesQuery.get();
            return expensesSnapshot.docs.reduce((total, doc) => {
                const expense = doc.data();
                return total + expense.amount;
            }, 0);
        }
        else {
            // For more than 10 categories, fetch all and filter in memory
            const expensesSnapshot = await expensesQuery.get();
            return expensesSnapshot.docs
                .filter(doc => budget.categories.includes(doc.data().category))
                .reduce((total, doc) => total + doc.data().amount, 0);
        }
    }
    const expensesSnapshot = await expensesQuery.get();
    return expensesSnapshot.docs.reduce((total, doc) => {
        const expense = doc.data();
        return total + expense.amount;
    }, 0);
};
/**
 * Send push notification to user
 */
const sendPushNotification = async (userId, notification) => {
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
                // FCM data values must be strings - safely convert notification.data
                ...(notification.data ? Object.fromEntries(Object.entries(notification.data).map(([k, v]) => [k, String(v)])) : {})
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
        logger_1.default.error('Failed to send push notification', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId
        });
    }
};
/**
 * Generate budget alerts based on current spending
 */
const generateBudgetAlerts = async (userId) => {
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
            const currentSpent = await calculateBudgetSpending(userId, budget);
            // Guard against division by zero
            if (budget.amount === 0) {
                logger_1.default.warn('Budget has zero amount', { budgetId: budget.id, userId });
                continue;
            }
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
                            budgetId: budget.id || '',
                            currentSpent: String(currentSpent),
                            budgetAmount: String(budget.amount),
                            percentage: String(spentPercentage)
                        },
                        read: false,
                        createdAt: new Date().toISOString(),
                        priority: threshold.type === 'exceeded' ? 'high' : 'medium'
                    };
                    // Save notification
                    await firebase_1.db.collection('notifications').add(alert);
                    // Send push notification
                    await sendPushNotification(userId, alert);
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
        logger_1.default.error('Failed to calculate budget alert', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId
        });
    }
    return alerts;
};
/**
 * Get user notifications
 */
const getUserNotifications = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const notificationsRef = firebase_1.db.collection('notifications');
        const q = notificationsRef.where('userId', '==', userId);
        const snapshot = await q.get();
        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.json({ success: true, data: notifications });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching notifications', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch notifications', 500, false));
    }
};
exports.getUserNotifications = getUserNotifications;
/**
 * Mark notification as read
 */
const markAsRead = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { notificationId } = req.params;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        // Verify notification belongs to user before updating
        const notificationDoc = await firebase_1.db.doc(`notifications/${notificationId}`).get();
        if (!notificationDoc.exists) {
            throw new errorHandler_1.AppError('Notification not found', 404, true);
        }
        const notification = notificationDoc.data();
        if ((notification === null || notification === void 0 ? void 0 : notification.userId) !== userId) {
            throw new errorHandler_1.AppError('Unauthorized: Cannot update another user\'s notification', 403, true);
        }
        await firebase_1.db.doc(`notifications/${notificationId}`).update({
            read: true,
            updatedAt: new Date().toISOString()
        });
        res.json({ success: true, message: 'Notification marked as read' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error updating notification', {
            error: error instanceof Error ? error.message : 'Unknown error',
            notificationId: req.params.notificationId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to update notification', 500, false));
    }
};
exports.markAsRead = markAsRead;
/**
 * Update notification preferences
 */
const updatePreferences = async (req, res, next) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        // Validate threshold values
        const warningThreshold = (_b = req.body.budgetWarningThreshold) !== null && _b !== void 0 ? _b : 80;
        const exceededThreshold = (_c = req.body.budgetExceededThreshold) !== null && _c !== void 0 ? _c : 100;
        const reminderDays = (_d = req.body.reminderDaysBefore) !== null && _d !== void 0 ? _d : 3;
        if (typeof warningThreshold !== 'number' || warningThreshold < 0 || warningThreshold > 100) {
            throw new errorHandler_1.AppError('Budget warning threshold must be a number between 0 and 100', 400, true);
        }
        if (typeof exceededThreshold !== 'number' || exceededThreshold < 0 || exceededThreshold > 100) {
            throw new errorHandler_1.AppError('Budget exceeded threshold must be a number between 0 and 100', 400, true);
        }
        if (warningThreshold >= exceededThreshold) {
            throw new errorHandler_1.AppError('Warning threshold must be less than exceeded threshold', 400, true);
        }
        if (typeof reminderDays !== 'number' || reminderDays < 0 || reminderDays > 30) {
            throw new errorHandler_1.AppError('Reminder days must be a number between 0 and 30', 400, true);
        }
        const preferences = {
            userId,
            budgetAlerts: (_e = req.body.budgetAlerts) !== null && _e !== void 0 ? _e : true,
            billReminders: (_f = req.body.billReminders) !== null && _f !== void 0 ? _f : true,
            goalMilestones: (_g = req.body.goalMilestones) !== null && _g !== void 0 ? _g : true,
            spendingInsights: (_h = req.body.spendingInsights) !== null && _h !== void 0 ? _h : true,
            pushNotifications: (_j = req.body.pushNotifications) !== null && _j !== void 0 ? _j : true,
            emailNotifications: (_k = req.body.emailNotifications) !== null && _k !== void 0 ? _k : false,
            budgetWarningThreshold: warningThreshold,
            budgetExceededThreshold: exceededThreshold,
            reminderDaysBefore: reminderDays
        };
        await firebase_1.db.doc(`users/${userId}`).update({
            notificationPreferences: preferences,
            updatedAt: new Date().toISOString()
        });
        res.json({ success: true, data: preferences, message: 'Preferences updated successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error updating preferences', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_l = req.user) === null || _l === void 0 ? void 0 : _l.uid
        });
        next(new errorHandler_1.AppError('Failed to update preferences', 500, false));
    }
};
exports.updatePreferences = updatePreferences;
/**
 * Register FCM token for push notifications
 */
const registerFCMToken = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { token } = req.body;
        if (!userId || !token) {
            throw new errorHandler_1.AppError('User ID and token required', 400, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userRef = firebase_1.db.doc(`users/${userId}`);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            // Create user document with FCM token if it doesn't exist
            await userRef.set({
                fcmTokens: [token],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        else {
            const userData = userDoc.data();
            const existingTokens = (userData === null || userData === void 0 ? void 0 : userData.fcmTokens) || [];
            if (!existingTokens.includes(token)) {
                await userRef.update({
                    fcmTokens: [...existingTokens, token],
                    updatedAt: new Date().toISOString()
                });
            }
        }
        res.json({ success: true, message: 'FCM token registered successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error registering FCM token', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to register token', 500, false));
    }
};
exports.registerFCMToken = registerFCMToken;
/**
 * Check budget alerts (called by scheduled Cloud Function)
 */
const checkBudgetAlerts = async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            throw new errorHandler_1.AppError('User ID required', 400, true);
        }
        const alerts = await generateBudgetAlerts(userId);
        res.json({ success: true, data: alerts });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error checking budget alerts', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.body.userId
        });
        next(new errorHandler_1.AppError('Failed to check budget alerts', 500, false));
    }
};
exports.checkBudgetAlerts = checkBudgetAlerts;
