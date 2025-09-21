"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const schemas_1 = require("../models/schemas");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Per-route rate limits
const readLimit = rateLimiter_1.createRateLimiter.read();
const writeLimit = rateLimiter_1.createRateLimiter.api();
// Get user notifications
router.get('/', readLimit, auth_1.auth, notificationController_1.NotificationController.getUserNotifications);
// Mark notification as read
router.patch('/:notificationId/read', writeLimit, auth_1.auth, (0, validation_1.validateParams)(schemas_1.markNotificationReadParamsSchema), notificationController_1.NotificationController.markAsRead);
// Update notification preferences
router.put('/preferences', writeLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.updateNotificationPreferencesSchema), notificationController_1.NotificationController.updatePreferences);
// Register FCM token
router.post('/fcm-token', writeLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.registerFcmTokenSchema), notificationController_1.NotificationController.registerFCMToken);
// Check budget alerts (for scheduled tasks) - internal only
// Note: cronRateLimiter should be applied before requireCronAuth to count failed attempts
router.post('/check-budget-alerts', auth_1.cronRateLimiter, auth_1.requireCronAuth, notificationController_1.NotificationController.checkBudgetAlerts);
exports.default = router;
