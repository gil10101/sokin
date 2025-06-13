import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { auth } from '../middleware/auth';

const router = Router();

// Get user notifications
router.get('/', auth, NotificationController.getUserNotifications);

// Mark notification as read
router.patch('/:notificationId/read', auth, NotificationController.markAsRead);

// Update notification preferences
router.put('/preferences', auth, NotificationController.updatePreferences);

// Register FCM token
router.post('/fcm-token', auth, NotificationController.registerFCMToken);

// Check budget alerts (for scheduled tasks)
router.post('/check-budget-alerts', NotificationController.checkBudgetAlerts);

export default router; 