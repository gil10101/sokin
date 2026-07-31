/**
 * User Routes
 * 
 * Consolidated routes for user profile management including:
 * - Profile CRUD operations (GET/PUT /profile for current user)
 * - User management by ID (POST, GET/PUT /:userId)
 * - User settings management
 * - Custom categories
 * 
 * All routes require Firebase Authentication.
 */

import express from 'express';
import { auth } from '../middleware/auth';
import { validate, validateParams } from '../middleware/validation';
import { createRateLimiter, rateLimiter } from '../middleware/rateLimiter';
import { updateUserSchema } from '../models/schemas';
import { getUserProfile, updateUserProfile } from '../controllers/users';
import usersProfileController from '../controllers/usersProfileController';
import Joi from 'joi';

const router = express.Router();

// Rate limiting configurations
const readRateLimit = createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = createRateLimiter.api(); // 100 requests per 15 minutes
const profileRateLimit = rateLimiter(50, 15 * 60 * 1000); // 50 writes per 15 minutes

// Validation schemas for user profile operations
const createProfileSchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'Name is required',
      'string.max': 'Name cannot exceed 100 characters',
    }),
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Valid email is required',
    }),
});

const updateProfileByIdSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional()
    .messages({
      'string.empty': 'Name cannot be empty',
      'string.max': 'Name cannot exceed 100 characters',
    }),
  email: Joi.string().email().optional()
    .messages({
      'string.email': 'Valid email is required',
    }),
  settings: Joi.object({
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR').optional(),
    theme: Joi.string().valid('light', 'dark', 'system').optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      push: Joi.boolean().optional(),
      monthlyReport: Joi.boolean().optional(),
      budgetAlerts: Joi.boolean().optional(),
      expenseNotifications: Joi.boolean().optional(),
    }).optional(),
  }).optional(),
}).min(1).messages({
  'object.min': 'At least one field to update is required',
});

const updateCategoriesSchema = Joi.object({
  categories: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .min(1)
    .max(50)
    .unique()
    .required()
    .messages({
      'array.min': 'At least one category is required',
      'array.max': 'Maximum 50 categories allowed',
      'array.unique': 'Duplicate categories are not allowed',
    }),
});

const userIdParamsSchema = Joi.object({
  userId: Joi.string().trim().min(1).max(128).required()
});

// =============================================================================
// Current User Profile Routes (/profile)
// These use the authenticated user's ID from the token
// =============================================================================

/**
 * @route   GET /api/users/profile
 * @desc    Get current user's profile
 * @access  Private (requires authentication)
 */
router.get('/profile', auth, readRateLimit, getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private (requires authentication)
 */
router.put('/profile', auth, writeRateLimit, validate(updateUserSchema), updateUserProfile);

// =============================================================================
// User Management Routes (/:userId)
// These allow operations on specific user IDs (with ownership verification)
// =============================================================================

/**
 * @route   POST /api/users
 * @desc    Create user profile during registration
 * @access  Private (requires authentication)
 * @body    { name: string, email: string }
 */
router.post(
  '/',
  auth,
  profileRateLimit,
  validate(createProfileSchema),
  usersProfileController.createUserProfile
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user profile by ID
 * @access  Private (owner only)
 */
router.get(
  '/:userId',
  auth,
  readRateLimit,
  validateParams(userIdParamsSchema),
  usersProfileController.getUserProfile
);

/**
 * @route   PUT /api/users/:userId
 * @desc    Update user profile by ID
 * @access  Private (owner only)
 * @body    { name?: string, settings?: object }
 */
router.put(
  '/:userId',
  auth,
  profileRateLimit,
  validateParams(userIdParamsSchema),
  validate(updateProfileByIdSchema),
  usersProfileController.updateUserProfile
);

/**
 * @route   GET /api/users/:userId/categories
 * @desc    Get user's custom expense categories
 * @access  Private (owner only)
 */
router.get(
  '/:userId/categories',
  auth,
  profileRateLimit,
  validateParams(userIdParamsSchema),
  usersProfileController.getUserCategories
);

/**
 * @route   PUT /api/users/:userId/categories
 * @desc    Update user's custom expense categories
 * @access  Private (owner only)
 * @body    { categories: string[] }
 */
router.put(
  '/:userId/categories',
  auth,
  profileRateLimit,
  validateParams(userIdParamsSchema),
  validate(updateCategoriesSchema),
  usersProfileController.updateUserCategories
);

export default router; 
