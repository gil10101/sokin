import { Request, Response } from 'express';
import { db, auth } from '../config/firebase';
import { getMessaging } from 'firebase-admin/messaging';
import { Notification, NotificationPreferences, Budget, Expense } from '../models/types';

export class NotificationController {
  
  // Get user notifications
  static async getUserNotifications(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const notificationsRef = db.collection('notifications');
      const q = notificationsRef.where('userId', '==', userId);
      const snapshot = await q.get();
      
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({ notifications });
    } catch (error: unknown) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  }

  // Mark notification as read
  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { notificationId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      await db.doc(`notifications/${notificationId}`).update({
        read: true,
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error: unknown) {
      console.error('Error updating notification:', error);
      res.status(500).json({ error: 'Failed to update notification' });
    }
  }

  // Update notification preferences
  static async updatePreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const preferences: NotificationPreferences = {
        userId,
        budgetAlerts: req.body.budgetAlerts ?? true,
        billReminders: req.body.billReminders ?? true,
        goalMilestones: req.body.goalMilestones ?? true,
        spendingInsights: req.body.spendingInsights ?? true,
        pushNotifications: req.body.pushNotifications ?? true,
        emailNotifications: req.body.emailNotifications ?? false,
        budgetWarningThreshold: req.body.budgetWarningThreshold ?? 80,
        budgetExceededThreshold: req.body.budgetExceededThreshold ?? 100,
        reminderDaysBefore: req.body.reminderDaysBefore ?? 3
      };

      await db.doc(`users/${userId}`).update({
        notificationPreferences: preferences,
        updatedAt: new Date().toISOString()
      });

      res.json({ preferences });
    } catch (error: unknown) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  }

  // Register FCM token for push notifications
  static async registerFCMToken(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { token } = req.body;
      
      if (!userId || !token) {
        return res.status(400).json({ error: 'User ID and token required' });
      }

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const userRef = db.doc(`users/${userId}`);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const existingTokens = userData?.fcmTokens || [];
        
        if (!existingTokens.includes(token)) {
          await userRef.update({
            fcmTokens: [...existingTokens, token],
            updatedAt: new Date().toISOString()
          });
        }
      }

      res.json({ success: true });
    } catch (error: unknown) {
      console.error('Error registering FCM token:', error);
      res.status(500).json({ error: 'Failed to register token' });
    }
  }

  // Check budget alerts (called by scheduled Cloud Function)
  static async checkBudgetAlerts(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const alerts = await NotificationController.generateBudgetAlerts(userId);
      
      res.json({ alerts });
    } catch (error: unknown) {
      console.error('Error checking budget alerts:', error);
      res.status(500).json({ error: 'Failed to check budget alerts' });
    }
  }

  // Generate budget alerts based on current spending
  static async generateBudgetAlerts(userId: string): Promise<Notification[]> {
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
        const currentSpent = await NotificationController.calculateBudgetSpending(userId, budget);
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
            await db.collection('notifications').add(alert);
            
            // Send push notification
            await NotificationController.sendPushNotification(userId, alert);
            
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
      
    }

    return alerts;
  }

  // Calculate current spending for a budget
  static async calculateBudgetSpending(userId: string, budget: Budget): Promise<number> {
    if (!db) {
      
      return 0;
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
      const expense = doc.data() as Expense;
      return total + expense.amount;
    }, 0);
  }

  // Send push notification to user
  static async sendPushNotification(userId: string, notification: Notification) {
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
          ...notification.data
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
      
    }
  }
} 