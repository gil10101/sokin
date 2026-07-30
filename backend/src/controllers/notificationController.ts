/**
 * Notification Controller
 * 
 * Handles notification management, FCM token registration,
 * budget alerts, and push notification delivery.
 * 
 * @module controllers/notificationController
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { getMessaging } from 'firebase-admin/messaging';
import { Notification, NotificationPreferences, Budget, Expense } from '../models/types';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { normalizeDateFields } from '../utils/firestore';
import { invalidateDashboardCache } from './dashboardController';

/**
 * Calculate current spending for a budget
 */
const calculateBudgetSpending = async (userId: string, budget: Budget): Promise<number> => {
  if (!db) {
    throw new AppError('Database not initialized', 500, false);
  }

  const now = new Date();
  const startDate = new Date(budget.startDate);
  let endDate: Date;

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
  const expensesRef = db.collection('expenses');
  const startDateIso = startDate.toISOString();
  const endDateIso = endDate.toISOString();
  let expensesQuery = expensesRef
    .where('userId', '==', userId)
    .where('date', '>=', startDateIso)
    .where('date', '<=', endDateIso);

  // Filter by categories if specified
  // Firestore 'in' operator has a limit of 10 values, so we need to chunk
  if (budget.categories && budget.categories.length > 0) {
    if (budget.categories.length <= 10) {
      expensesQuery = expensesQuery.where('category', 'in', budget.categories);
      const expensesSnapshot = await expensesQuery.get();
      return expensesSnapshot.docs.reduce((total, doc) => {
        const expense = doc.data() as Expense;
        return total + expense.amount;
      }, 0);
    } else {
      // For more than 10 categories, fetch all and filter in memory
      const expensesSnapshot = await expensesQuery.get();
      return expensesSnapshot.docs
        .filter(doc => budget.categories!.includes((doc.data() as Expense).category))
        .reduce((total, doc) => total + (doc.data() as Expense).amount, 0);
    }
  }

  const expensesSnapshot = await expensesQuery.get();
  
  return expensesSnapshot.docs.reduce((total, doc) => {
    const expense = doc.data() as Expense;
    return total + expense.amount;
  }, 0);
};

const normalizeNotification = (notification: Notification): Notification =>
  normalizeDateFields(notification, ['createdAt', 'scheduledFor']);

/**
 * Send push notification to user
 */
const sendPushNotification = async (userId: string, notification: Notification): Promise<void> => {
  try {
    if (!db) {
      return;
    }

    const userDoc = await db.doc(`users/${userId}`).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || [];
    
    if (fcmTokens.length === 0) return;

    const messaging = getMessaging();
    const message = {
      notification: {
        title: notification.title,
        body: notification.message
      },
      data: {
        type: notification.type,
        notificationId: notification.id || '',
        // FCM data values must be strings - safely convert notification.data
        ...(notification.data ? Object.fromEntries(
          Object.entries(notification.data).map(([k, v]) => [k, String(v)])
        ) : {})
      },
      tokens: fcmTokens
    };

    const response = await messaging.sendEachForMulticast(message);
    
    // Remove invalid tokens
    const tokensToRemove: string[] = [];
    response.responses.forEach((resp: { success: boolean; error?: { code: string } }, idx: number) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        tokensToRemove.push(fcmTokens[idx]);
      }
    });

    if (tokensToRemove.length > 0) {
      const validTokens = fcmTokens.filter((token: string) => !tokensToRemove.includes(token));
      await db.doc(`users/${userId}`).update({
        fcmTokens: validTokens
      });
    }

  } catch (error) {
    logger.error('Failed to send push notification', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId 
    });
  }
};

/**
 * Generate budget alerts based on current spending
 */
const generateBudgetAlerts = async (userId: string): Promise<Notification[]> => {
  const alerts: Notification[] = [];

  try {
    if (!db) {
      return alerts;
    }

    // Get user's active budgets
    const budgetsRef = db.collection('budgets');
    const budgetsQuery = budgetsRef.where('userId', '==', userId);
    const budgetsSnapshot = await budgetsQuery.get();

    for (const budgetDoc of budgetsSnapshot.docs) {
      const budget = { id: budgetDoc.id, ...budgetDoc.data() } as Budget;
      
      if (!budget.isActive) continue;

      // Calculate current spending for this budget
      const currentSpent = await calculateBudgetSpending(userId, budget);
      
      // Guard against division by zero
      if (budget.amount === 0) {
        logger.warn('Budget has zero amount', { budgetId: budget.id, userId });
        continue;
      }
      
      const spentPercentage = (currentSpent / budget.amount) * 100;

      // Check alert thresholds
      const thresholds = budget.alertThresholds || [
        { percentage: 80, type: 'warning' as const, notified: false },
        { percentage: 100, type: 'exceeded' as const, notified: false }
      ];

      for (const threshold of thresholds) {
        if (spentPercentage >= threshold.percentage && !threshold.notified) {
          const alert: Notification = {
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
            dismissed: false,
            createdAt: new Date().toISOString(),
            priority: threshold.type === 'exceeded' ? 'high' : 'medium'
          };

          // Save notification
          await db.collection('notifications').add(alert);
          
          // Send push notification
          await sendPushNotification(userId, alert);
          
          // Mark threshold as notified
          threshold.notified = true;
          alerts.push(alert);
        }
      }

      // Update budget with current spending and threshold states
      await db.doc(`budgets/${budget.id!}`).update({
        currentSpent,
        remainingAmount: Math.max(0, budget.amount - currentSpent),
        alertThresholds: thresholds,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Failed to calculate budget alert', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId 
    });
  }

  return alerts;
};

/**
 * Get user notifications
 */
export const getUserNotifications = async (
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

    const notificationsRef = db.collection('notifications');
    const q = notificationsRef
      .where('userId', '==', userId)
      .where('dismissed', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(100);
    const snapshot = await q.get();

    const notifications = snapshot.docs
      .map(doc => normalizeNotification({
        id: doc.id,
        ...doc.data()
      } as Notification));

    res.json({ success: true, data: notifications });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching notifications', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to fetch notifications', 500, false));
  }
};

/**
 * Create a new notification for the current user
 */
export const createNotification = async (
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

    const { title, message, type, data, link } = req.body;

    const notification: Notification = {
      userId,
      title,
      message,
      type,
      data,
      link,
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      priority: 'low'
    };

    const docRef = await db.collection('notifications').add(notification);

    await invalidateDashboardCache(userId);

    res.status(201).json({
      success: true,
      data: normalizeNotification({ id: docRef.id, ...notification })
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error creating notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to create notification', 500, false));
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { notificationId } = req.params;
    
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Verify notification belongs to user before updating
    const notificationDoc = await db.doc(`notifications/${notificationId}`).get();
    if (!notificationDoc.exists) {
      throw new AppError('Notification not found', 404, true);
    }
    
    const notification = notificationDoc.data();
    if (notification?.userId !== userId) {
      throw new AppError('Unauthorized: Cannot update another user\'s notification', 403, true);
    }

    await db.doc(`notifications/${notificationId}`).update({
      read: true,
      updatedAt: new Date().toISOString()
    });

    await invalidateDashboardCache(userId);

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error updating notification', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      notificationId: req.params.notificationId, 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to update notification', 500, false));
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (
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

    const snapshot = await db
      .collection('notifications')
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    const BATCH_LIMIT = 500;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      chunk.forEach((doc) => {
        batch.update(doc.ref, { read: true, updatedAt: new Date().toISOString() });
      });
      await batch.commit();
    }

    await invalidateDashboardCache(userId);

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error marking notifications as read', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to update notifications', 500, false));
  }
};

/**
 * Dismiss a notification
 */
export const dismissNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { notificationId } = req.params;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const notificationDoc = await db.doc(`notifications/${notificationId}`).get();
    if (!notificationDoc.exists) {
      throw new AppError('Notification not found', 404, true);
    }

    const notification = notificationDoc.data();
    if (notification?.userId !== userId) {
      throw new AppError('Unauthorized: Cannot update another user\'s notification', 403, true);
    }

    await db.doc(`notifications/${notificationId}`).update({
      dismissed: true,
      updatedAt: new Date().toISOString()
    });

    await invalidateDashboardCache(userId);

    res.json({ success: true, message: 'Notification dismissed' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error dismissing notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      notificationId: req.params.notificationId,
      userId: req.user?.uid
    });
    next(new AppError('Failed to dismiss notification', 500, false));
  }
};

/**
 * Dismiss all notifications
 */
export const dismissAllNotifications = async (
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

    const snapshot = await db
      .collection('notifications')
      .where('userId', '==', userId)
      .where('dismissed', '==', false)
      .get();

    const BATCH_LIMIT = 500;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      chunk.forEach((doc) => {
        batch.update(doc.ref, { dismissed: true, updatedAt: new Date().toISOString() });
      });
      await batch.commit();
    }

    await invalidateDashboardCache(userId);

    res.json({ success: true, message: 'All notifications dismissed' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error dismissing notifications', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to dismiss notifications', 500, false));
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { notificationId } = req.params;

    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const notificationDoc = await db.doc(`notifications/${notificationId}`).get();
    if (!notificationDoc.exists) {
      throw new AppError('Notification not found', 404, true);
    }

    const notification = notificationDoc.data();
    if (notification?.userId !== userId) {
      throw new AppError('Unauthorized: Cannot delete another user\'s notification', 403, true);
    }

    await db.doc(`notifications/${notificationId}`).delete();

    await invalidateDashboardCache(userId);

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error deleting notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
      notificationId: req.params.notificationId,
      userId: req.user?.uid
    });
    next(new AppError('Failed to delete notification', 500, false));
  }
};

/**
 * Update notification preferences
 */
export const updatePreferences = async (
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

    // Validate threshold values
    const warningThreshold = req.body.budgetWarningThreshold ?? 80;
    const exceededThreshold = req.body.budgetExceededThreshold ?? 100;
    const reminderDays = req.body.reminderDaysBefore ?? 3;

    if (typeof warningThreshold !== 'number' || warningThreshold < 0 || warningThreshold > 100) {
      throw new AppError('Budget warning threshold must be a number between 0 and 100', 400, true);
    }
    if (typeof exceededThreshold !== 'number' || exceededThreshold < 0 || exceededThreshold > 100) {
      throw new AppError('Budget exceeded threshold must be a number between 0 and 100', 400, true);
    }
    if (warningThreshold >= exceededThreshold) {
      throw new AppError('Warning threshold must be less than exceeded threshold', 400, true);
    }
    if (typeof reminderDays !== 'number' || reminderDays < 0 || reminderDays > 30) {
      throw new AppError('Reminder days must be a number between 0 and 30', 400, true);
    }

    const preferences: NotificationPreferences = {
      userId,
      budgetAlerts: req.body.budgetAlerts ?? true,
      billReminders: req.body.billReminders ?? true,
      goalMilestones: req.body.goalMilestones ?? true,
      spendingInsights: req.body.spendingInsights ?? true,
      pushNotifications: req.body.pushNotifications ?? true,
      emailNotifications: req.body.emailNotifications ?? false,
      budgetWarningThreshold: warningThreshold,
      budgetExceededThreshold: exceededThreshold,
      reminderDaysBefore: reminderDays
    };

    await db.doc(`users/${userId}`).update({
      notificationPreferences: preferences,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, data: preferences, message: 'Preferences updated successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error updating preferences', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to update preferences', 500, false));
  }
};

/**
 * Get notification preferences
 */
export const getPreferences = async (
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

    const userDoc = await db.doc(`users/${userId}`).get();
    if (!userDoc.exists) {
      throw new AppError('User not found', 404, true);
    }

    const userData = userDoc.data();
    const preferences = userData?.notificationPreferences || null;

    res.json({ success: true, data: preferences });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error fetching preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid
    });
    next(new AppError('Failed to fetch preferences', 500, false));
  }
};

/**
 * Register FCM token for push notifications
 */
export const registerFCMToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const { token } = req.body;
    
    if (!userId || !token) {
      throw new AppError('User ID and token required', 400, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const userRef = db.doc(`users/${userId}`);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      // Create user document with FCM token if it doesn't exist
      await userRef.set({
        fcmTokens: [token],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      const userData = userDoc.data();
      const existingTokens = userData?.fcmTokens || [];
      
      if (!existingTokens.includes(token)) {
        await userRef.update({
          fcmTokens: [...existingTokens, token],
          updatedAt: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, message: 'FCM token registered successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error registering FCM token', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      userId: req.user?.uid 
    });
    next(new AppError('Failed to register token', 500, false));
  }
};

/**
 * Check budget alerts (called by scheduled Cloud Function)
 */
export const checkBudgetAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Query all budgets that are active
    const budgetsSnapshot = await db.collection('budgets')
      .where('isActive', '==', true)
      .get();

    // Collect unique user IDs from active budgets
    const userIds = new Set<string>();
    budgetsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });

    const allAlerts: Notification[] = [];
    for (const userId of userIds) {
      const alerts = await generateBudgetAlerts(userId);
      allAlerts.push(...alerts);
    }

    res.json({ success: true, data: { usersProcessed: userIds.size, alertsGenerated: allAlerts.length } });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    logger.error('Error checking budget alerts', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    next(new AppError('Failed to check budget alerts', 500, false));
  }
};
