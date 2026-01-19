"use strict";
/**
 * Receipt Routes
 *
 * Routes for receipt processing with OCR and image upload.
 *
 * @module routes/receiptRoutes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const receiptController_1 = require("../controllers/receiptController");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Rate limiting for receipt processing
const writeRateLimit = rateLimiter_1.createRateLimiter.api();
/**
 * @route   POST /api/receipts/process
 * @desc    Process receipt with OCR and extract expense data
 * @access  Private
 */
router.post('/process', writeRateLimit, auth_1.auth, receiptController_1.uploadMiddleware, (0, errorHandler_1.asyncHandler)(receiptController_1.processReceipt));
exports.default = router;
