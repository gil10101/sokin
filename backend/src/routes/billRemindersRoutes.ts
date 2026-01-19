/**
 * Bill Reminders Routes
 * 
 * RESTful routes for bill reminder management with rate limiting,
 * authentication, and validation middleware.
 * 
 * @module routes/billRemindersRoutes
 */

import { Router } from 'express';
import { 
  getUserBillReminders, 
  createBillReminder, 
  markBillAsPaid, 
  updateBillReminder, 
  deleteBillReminder 
} from '../controllers/billRemindersController';
import { auth } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Apply rate limiting
const readRateLimit = createRateLimiter.read();
const writeRateLimit = createRateLimiter.api();

/**
 * @route   GET /api/bill-reminders
 * @desc    Get user's bill reminders
 * @access  Private
 */
router.get('/', readRateLimit, auth, asyncHandler(getUserBillReminders));

/**
 * @route   POST /api/bill-reminders
 * @desc    Create new bill reminder
 * @access  Private
 */
router.post('/', writeRateLimit, auth, asyncHandler(createBillReminder));

/**
 * @route   POST /api/bill-reminders/:billId/pay
 * @desc    Mark bill as paid
 * @access  Private
 */
router.post('/:billId/pay', writeRateLimit, auth, asyncHandler(markBillAsPaid));

/**
 * @route   PUT /api/bill-reminders/:billId
 * @desc    Update bill reminder
 * @access  Private
 */
router.put('/:billId', writeRateLimit, auth, asyncHandler(updateBillReminder));

/**
 * @route   DELETE /api/bill-reminders/:billId
 * @desc    Delete bill reminder
 * @access  Private
 */
router.delete('/:billId', writeRateLimit, auth, asyncHandler(deleteBillReminder));

export default router; 
