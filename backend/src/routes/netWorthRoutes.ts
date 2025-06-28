import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validation';
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

// Apply authentication middleware to all routes
router.use(auth);

/**
 * Asset Routes
 */

// GET /api/net-worth/assets - Get all assets for the user
router.get('/assets', getUserAssets);

// POST /api/net-worth/assets - Create a new asset
router.post('/assets', validate(createAssetSchema), createAsset);

// PUT /api/net-worth/assets/:id - Update an asset
router.put('/assets/:id', validate(updateAssetSchema), updateAsset);

// DELETE /api/net-worth/assets/:id - Delete an asset
router.delete('/assets/:id', deleteAsset);

/**
 * Liability Routes
 */

// GET /api/net-worth/liabilities - Get all liabilities for the user
router.get('/liabilities', getUserLiabilities);

// POST /api/net-worth/liabilities - Create a new liability
router.post('/liabilities', validate(createLiabilitySchema), createLiability);

// PUT /api/net-worth/liabilities/:id - Update a liability
router.put('/liabilities/:id', validate(updateLiabilitySchema), updateLiability);

// DELETE /api/net-worth/liabilities/:id - Delete a liability
router.delete('/liabilities/:id', deleteLiability);

/**
 * Net Worth Calculation Routes
 */

// GET /api/net-worth/calculate - Calculate current net worth
router.get('/calculate', calculateNetWorth);

// GET /api/net-worth/history - Get net worth history/snapshots
router.get('/history', getNetWorthHistory);

// GET /api/net-worth/trends - Get net worth trends
router.get('/trends', getNetWorthTrends);

// GET /api/net-worth/insights - Get net worth insights
router.get('/insights', getNetWorthInsights);

export default router; 