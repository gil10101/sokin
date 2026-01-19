"use strict";
/**
 * Notification Routes
 *
 * RESTful routes for notification management, preferences,
 * FCM token registration, and scheduled budget alerts.
 *
 * @module routes/notificationRoutes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const schemas_1 = require("../models/schemas");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Per-route rate limits
const readLimit = rateLimiter_1.createRateLimiter.read();
const writeLimit = rateLimiter_1.createRateLimiter.api();
/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', readLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(notificationController_1.getUserNotifications));
/**
 * @route   PATCH /api/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:notificationId/read', writeLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.markNotificationReadParamsSchema), (0, errorHandler_1.asyncHandler)(notificationController_1.markAsRead));
/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private
 */
router.put('/preferences', writeLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.updateNotificationPreferencesSchema), (0, errorHandler_1.asyncHandler)(notificationController_1.updatePreferences));
/**
 * @route   POST /api/notifications/fcm-token
 * @desc    Register FCM token for push notifications
 * @access  Private
 */
router.post('/fcm-token', writeLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.registerFcmTokenSchema), (0, errorHandler_1.asyncHandler)(notificationController_1.registerFCMToken));
/**
 * @route   POST /api/notifications/check-budget-alerts
 * @desc    Check budget alerts (for scheduled tasks) - internal only
 * @access  Internal (cron job authentication)
 */
router.post('/check-budget-alerts', auth_1.cronRateLimiter, auth_1.requireCronAuth, (0, errorHandler_1.asyncHandler)(notificationController_1.checkBudgetAlerts));
exports.default = router;
