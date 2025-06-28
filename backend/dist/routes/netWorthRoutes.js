"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const netWorthController_1 = require("../controllers/netWorthController");
const schemas_1 = require("../models/schemas");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(auth_1.auth);
/**
 * Asset Routes
 */
// GET /api/net-worth/assets - Get all assets for the user
router.get('/assets', netWorthController_1.getUserAssets);
// POST /api/net-worth/assets - Create a new asset
router.post('/assets', (0, validation_1.validate)(schemas_1.createAssetSchema), netWorthController_1.createAsset);
// PUT /api/net-worth/assets/:id - Update an asset
router.put('/assets/:id', (0, validation_1.validate)(schemas_1.updateAssetSchema), netWorthController_1.updateAsset);
// DELETE /api/net-worth/assets/:id - Delete an asset
router.delete('/assets/:id', netWorthController_1.deleteAsset);
/**
 * Liability Routes
 */
// GET /api/net-worth/liabilities - Get all liabilities for the user
router.get('/liabilities', netWorthController_1.getUserLiabilities);
// POST /api/net-worth/liabilities - Create a new liability
router.post('/liabilities', (0, validation_1.validate)(schemas_1.createLiabilitySchema), netWorthController_1.createLiability);
// PUT /api/net-worth/liabilities/:id - Update a liability
router.put('/liabilities/:id', (0, validation_1.validate)(schemas_1.updateLiabilitySchema), netWorthController_1.updateLiability);
// DELETE /api/net-worth/liabilities/:id - Delete a liability
router.delete('/liabilities/:id', netWorthController_1.deleteLiability);
/**
 * Net Worth Calculation Routes
 */
// GET /api/net-worth/calculate - Calculate current net worth
router.get('/calculate', netWorthController_1.calculateNetWorth);
// GET /api/net-worth/history - Get net worth history/snapshots
router.get('/history', netWorthController_1.getNetWorthHistory);
// GET /api/net-worth/trends - Get net worth trends
router.get('/trends', netWorthController_1.getNetWorthTrends);
// GET /api/net-worth/insights - Get net worth insights
router.get('/insights', netWorthController_1.getNetWorthInsights);
exports.default = router;
