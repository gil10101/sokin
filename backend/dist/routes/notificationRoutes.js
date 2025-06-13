"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user notifications
router.get('/', auth_1.auth, notificationController_1.NotificationController.getUserNotifications);
// Mark notification as read
router.patch('/:notificationId/read', auth_1.auth, notificationController_1.NotificationController.markAsRead);
// Update notification preferences
router.put('/preferences', auth_1.auth, notificationController_1.NotificationController.updatePreferences);
// Register FCM token
router.post('/fcm-token', auth_1.auth, notificationController_1.NotificationController.registerFCMToken);
// Check budget alerts (for scheduled tasks)
router.post('/check-budget-alerts', notificationController_1.NotificationController.checkBudgetAlerts);
exports.default = router;
