/**
 * Notification Routes
 * 
 * RESTful routes for notification management, preferences,
 * FCM token registration, and scheduled budget alerts.
 * 
 * @module routes/notificationRoutes
 */

import { Router } from 'express';
import { 
  getUserNotifications, 
  createNotification,
  markAsRead, 
  markAllAsRead,
  dismissNotification,
  dismissAllNotifications,
  deleteNotification,
  getPreferences,
  updatePreferences, 
  registerFCMToken, 
  checkBudgetAlerts 
} from '../controllers/notificationController';
import { auth, requireCronAuth, cronRateLimiter } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  markNotificationReadParamsSchema,
  updateNotificationPreferencesSchema,
  registerFcmTokenSchema,
  createNotificationSchema
} from '../models/schemas';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Per-route rate limits
const readLimit = createRateLimiter.read();
const writeLimit = createRateLimiter.api();

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', readLimit, auth, asyncHandler(getUserNotifications));

/**
 * @route   POST /api/notifications
 * @desc    Create a notification for the current user
 * @access  Private
 */
router.post(
  '/',
  writeLimit,
  auth,
  validate(createNotificationSchema),
  asyncHandler(createNotification)
);

/**
 * @route   PATCH /api/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch(
  '/:notificationId/read', 
  writeLimit, 
  auth, 
  validateParams(markNotificationReadParamsSchema), 
  asyncHandler(markAsRead)
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', writeLimit, auth, asyncHandler(markAllAsRead));

/**
 * @route   PATCH /api/notifications/:notificationId/dismiss
 * @desc    Dismiss a notification
 * @access  Private
 */
router.patch(
  '/:notificationId/dismiss',
  writeLimit,
  auth,
  validateParams(markNotificationReadParamsSchema),
  asyncHandler(dismissNotification)
);

/**
 * @route   PATCH /api/notifications/dismiss-all
 * @desc    Dismiss all notifications
 * @access  Private
 */
router.patch('/dismiss-all', writeLimit, auth, asyncHandler(dismissAllNotifications));

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Delete a notification
 * @access  Private
 */
router.delete(
  '/:notificationId',
  writeLimit,
  auth,
  validateParams(markNotificationReadParamsSchema),
  asyncHandler(deleteNotification)
);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private
 */
router.put(
  '/preferences', 
  writeLimit, 
  auth, 
  validate(updateNotificationPreferencesSchema), 
  asyncHandler(updatePreferences)
);

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/preferences', readLimit, auth, asyncHandler(getPreferences));

/**
 * @route   POST /api/notifications/fcm-token
 * @desc    Register FCM token for push notifications
 * @access  Private
 */
router.post(
  '/fcm-token', 
  writeLimit, 
  auth, 
  validate(registerFcmTokenSchema), 
  asyncHandler(registerFCMToken)
);

/**
 * @route   POST /api/notifications/check-budget-alerts
 * @desc    Check budget alerts (for scheduled tasks) - internal only
 * @access  Internal (cron job authentication)
 */
router.post(
  '/check-budget-alerts', 
  cronRateLimiter, 
  requireCronAuth, 
  asyncHandler(checkBudgetAlerts)
);

export default router; 
