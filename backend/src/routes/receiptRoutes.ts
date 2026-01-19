/**
 * Receipt Routes
 * 
 * Routes for receipt processing with OCR and image upload.
 * 
 * @module routes/receiptRoutes
 */

import { Router } from 'express';
import { uploadMiddleware, processReceipt } from '../controllers/receiptController';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Rate limiting for receipt processing
const writeRateLimit = createRateLimiter.api();

/**
 * @route   POST /api/receipts/process
 * @desc    Process receipt with OCR and extract expense data
 * @access  Private
 */
router.post(
  '/process',
  writeRateLimit,
  auth,
  uploadMiddleware,
  asyncHandler(processReceipt)
);

export default router;
