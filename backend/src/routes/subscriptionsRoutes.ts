/**
 * Subscription Routes
 *
 * RESTful routes for subscription management.
 */

import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { createRateLimiter } from '../middleware/rateLimiter';
import { idParamsSchema, createSubscriptionSchema, updateSubscriptionSchema } from '../models/schemas';
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription
} from '../controllers/subscriptionsController';

const router = Router();

const readRateLimit = createRateLimiter.read();
const writeRateLimit = createRateLimiter.api();

/**
 * @route   GET /api/subscriptions
 * @desc    Get all subscriptions for authenticated user
 * @access  Private
 */
router.get('/', readRateLimit, auth, asyncHandler(getSubscriptions));

/**
 * @route   POST /api/subscriptions
 * @desc    Create a new subscription
 * @access  Private
 */
router.post(
  '/',
  writeRateLimit,
  auth,
  validate(createSubscriptionSchema),
  asyncHandler(createSubscription)
);

/**
 * @route   PUT /api/subscriptions/:id
 * @desc    Update a subscription
 * @access  Private (owner only)
 */
router.put(
  '/:id',
  writeRateLimit,
  auth,
  validateParams(idParamsSchema),
  validate(updateSubscriptionSchema),
  asyncHandler(updateSubscription)
);

/**
 * @route   DELETE /api/subscriptions/:id
 * @desc    Delete a subscription
 * @access  Private (owner only)
 */
router.delete(
  '/:id',
  writeRateLimit,
  auth,
  validateParams(idParamsSchema),
  asyncHandler(deleteSubscription)
);

export default router;

