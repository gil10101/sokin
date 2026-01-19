"use strict";
/**
 * Net Worth Routes
 *
 * RESTful routes for net worth management including assets,
 * liabilities, calculations, and financial insights.
 *
 * @module routes/netWorthRoutes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const errorHandler_1 = require("../middleware/errorHandler");
const rateLimiter_1 = require("../middleware/rateLimiter");
const netWorthController_1 = require("../controllers/netWorthController");
const schemas_1 = require("../models/schemas");
const router = (0, express_1.Router)();
// Apply rate limiting
const readRateLimit = rateLimiter_1.createRateLimiter.read();
const writeRateLimit = rateLimiter_1.createRateLimiter.api();
// Apply authentication middleware to all routes
router.use(auth_1.auth);
/**
 * Asset Routes
 */
/**
 * @route   GET /api/net-worth/assets
 * @desc    Get all assets for the user
 * @access  Private
 */
router.get('/assets', readRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.getUserAssets));
/**
 * @route   POST /api/net-worth/assets
 * @desc    Create a new asset
 * @access  Private
 */
router.post('/assets', writeRateLimit, (0, validation_1.validate)(schemas_1.createAssetSchema), (0, errorHandler_1.asyncHandler)(netWorthController_1.createAsset));
/**
 * @route   PUT /api/net-worth/assets/:id
 * @desc    Update an asset
 * @access  Private
 */
router.put('/assets/:id', writeRateLimit, (0, validation_1.validate)(schemas_1.updateAssetSchema), (0, errorHandler_1.asyncHandler)(netWorthController_1.updateAsset));
/**
 * @route   DELETE /api/net-worth/assets/:id
 * @desc    Delete an asset
 * @access  Private
 */
router.delete('/assets/:id', writeRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.deleteAsset));
/**
 * Liability Routes
 */
/**
 * @route   GET /api/net-worth/liabilities
 * @desc    Get all liabilities for the user
 * @access  Private
 */
router.get('/liabilities', readRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.getUserLiabilities));
/**
 * @route   POST /api/net-worth/liabilities
 * @desc    Create a new liability
 * @access  Private
 */
router.post('/liabilities', writeRateLimit, (0, validation_1.validate)(schemas_1.createLiabilitySchema), (0, errorHandler_1.asyncHandler)(netWorthController_1.createLiability));
/**
 * @route   PUT /api/net-worth/liabilities/:id
 * @desc    Update a liability
 * @access  Private
 */
router.put('/liabilities/:id', writeRateLimit, (0, validation_1.validate)(schemas_1.updateLiabilitySchema), (0, errorHandler_1.asyncHandler)(netWorthController_1.updateLiability));
/**
 * @route   DELETE /api/net-worth/liabilities/:id
 * @desc    Delete a liability
 * @access  Private
 */
router.delete('/liabilities/:id', writeRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.deleteLiability));
/**
 * Net Worth Calculation Routes
 */
/**
 * @route   GET /api/net-worth/calculate
 * @desc    Calculate current net worth
 * @access  Private
 */
router.get('/calculate', readRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.calculateNetWorth));
/**
 * @route   GET /api/net-worth/history
 * @desc    Get net worth history/snapshots
 * @access  Private
 */
router.get('/history', readRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.getNetWorthHistory));
/**
 * @route   GET /api/net-worth/trends
 * @desc    Get net worth trends
 * @access  Private
 */
router.get('/trends', readRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.getNetWorthTrends));
/**
 * @route   GET /api/net-worth/insights
 * @desc    Get net worth insights
 * @access  Private
 */
router.get('/insights', readRateLimit, (0, errorHandler_1.asyncHandler)(netWorthController_1.getNetWorthInsights));
exports.default = router;
