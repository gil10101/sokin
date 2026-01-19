"use strict";
/**
 * Bill Reminders Routes
 *
 * RESTful routes for bill reminder management with rate limiting,
 * authentication, and validation middleware.
 *
 * @module routes/billRemindersRoutes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billRemindersController_1 = require("../controllers/billRemindersController");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// Apply rate limiting
const readRateLimit = rateLimiter_1.createRateLimiter.read();
const writeRateLimit = rateLimiter_1.createRateLimiter.api();
/**
 * @route   GET /api/bill-reminders
 * @desc    Get user's bill reminders
 * @access  Private
 */
router.get('/', readRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(billRemindersController_1.getUserBillReminders));
/**
 * @route   POST /api/bill-reminders
 * @desc    Create new bill reminder
 * @access  Private
 */
router.post('/', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(billRemindersController_1.createBillReminder));
/**
 * @route   POST /api/bill-reminders/:billId/pay
 * @desc    Mark bill as paid
 * @access  Private
 */
router.post('/:billId/pay', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(billRemindersController_1.markBillAsPaid));
/**
 * @route   PUT /api/bill-reminders/:billId
 * @desc    Update bill reminder
 * @access  Private
 */
router.put('/:billId', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(billRemindersController_1.updateBillReminder));
/**
 * @route   DELETE /api/bill-reminders/:billId
 * @desc    Delete bill reminder
 * @access  Private
 */
router.delete('/:billId', writeRateLimit, auth_1.auth, (0, errorHandler_1.asyncHandler)(billRemindersController_1.deleteBillReminder));
exports.default = router;
