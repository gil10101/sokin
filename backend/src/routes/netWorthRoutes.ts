/**
 * Net Worth Routes
 * 
 * RESTful routes for net worth management including assets,
 * liabilities, calculations, and financial insights.
 * 
 * @module routes/netWorthRoutes
 */

import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { createRateLimiter } from '../middleware/rateLimiter';
import {
  getUserAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getUserLiabilities,
  createLiability,
  updateLiability,
  deleteLiability,
  calculateNetWorth,
  getNetWorthHistory,
  getNetWorthTrends,
  getNetWorthInsights
} from '../controllers/netWorthController';
import {
  createAssetSchema,
  updateAssetSchema,
  createLiabilitySchema,
  updateLiabilitySchema
} from '../models/schemas';

const router = Router();

// Apply rate limiting
const readRateLimit = createRateLimiter.read();
const writeRateLimit = createRateLimiter.api();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Asset Routes
 */

/**
 * @route   GET /api/net-worth/assets
 * @desc    Get all assets for the user
 * @access  Private
 */
router.get('/assets', readRateLimit, asyncHandler(getUserAssets));

/**
 * @route   POST /api/net-worth/assets
 * @desc    Create a new asset
 * @access  Private
 */
router.post('/assets', writeRateLimit, validate(createAssetSchema), asyncHandler(createAsset));

/**
 * @route   PUT /api/net-worth/assets/:id
 * @desc    Update an asset
 * @access  Private
 */
router.put('/assets/:id', writeRateLimit, validate(updateAssetSchema), asyncHandler(updateAsset));

/**
 * @route   DELETE /api/net-worth/assets/:id
 * @desc    Delete an asset
 * @access  Private
 */
router.delete('/assets/:id', writeRateLimit, asyncHandler(deleteAsset));

/**
 * Liability Routes
 */

/**
 * @route   GET /api/net-worth/liabilities
 * @desc    Get all liabilities for the user
 * @access  Private
 */
router.get('/liabilities', readRateLimit, asyncHandler(getUserLiabilities));

/**
 * @route   POST /api/net-worth/liabilities
 * @desc    Create a new liability
 * @access  Private
 */
router.post('/liabilities', writeRateLimit, validate(createLiabilitySchema), asyncHandler(createLiability));

/**
 * @route   PUT /api/net-worth/liabilities/:id
 * @desc    Update a liability
 * @access  Private
 */
router.put('/liabilities/:id', writeRateLimit, validate(updateLiabilitySchema), asyncHandler(updateLiability));

/**
 * @route   DELETE /api/net-worth/liabilities/:id
 * @desc    Delete a liability
 * @access  Private
 */
router.delete('/liabilities/:id', writeRateLimit, asyncHandler(deleteLiability));

/**
 * Net Worth Calculation Routes
 */

/**
 * @route   GET /api/net-worth/calculate
 * @desc    Calculate current net worth
 * @access  Private
 */
router.get('/calculate', readRateLimit, asyncHandler(calculateNetWorth));

/**
 * @route   GET /api/net-worth/history
 * @desc    Get net worth history/snapshots
 * @access  Private
 */
router.get('/history', readRateLimit, asyncHandler(getNetWorthHistory));

/**
 * @route   GET /api/net-worth/trends
 * @desc    Get net worth trends
 * @access  Private
 */
router.get('/trends', readRateLimit, asyncHandler(getNetWorthTrends));

/**
 * @route   GET /api/net-worth/insights
 * @desc    Get net worth insights
 * @access  Private
 */
router.get('/insights', readRateLimit, asyncHandler(getNetWorthInsights));

export default router; 
