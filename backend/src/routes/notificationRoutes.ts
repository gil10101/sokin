import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { auth, requireCronAuth, cronRateLimiter } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { 
  markNotificationReadParamsSchema,
  updateNotificationPreferencesSchema,
  registerFcmTokenSchema
} from '../models/schemas';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Per-route rate limits
const readLimit = createRateLimiter.read();
const writeLimit = createRateLimiter.api();

// Get user notifications
router.get('/', readLimit, auth, NotificationController.getUserNotifications);

// Mark notification as read
router.patch('/:notificationId/read', writeLimit, auth, validateParams(markNotificationReadParamsSchema), NotificationController.markAsRead);

// Update notification preferences
router.put('/preferences', writeLimit, auth, validate(updateNotificationPreferencesSchema), NotificationController.updatePreferences);

// Register FCM token
router.post('/fcm-token', writeLimit, auth, validate(registerFcmTokenSchema), NotificationController.registerFCMToken);

// Check budget alerts (for scheduled tasks) - internal only
// Note: cronRateLimiter should be applied before requireCronAuth to count failed attempts
router.post('/check-budget-alerts', cronRateLimiter, requireCronAuth, NotificationController.checkBudgetAlerts);

export default router; 