"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const schemas_1 = require("../models/schemas");
const users_1 = require("../controllers/users");
const usersProfileController_1 = __importDefault(require("../controllers/usersProfileController"));
const joi_1 = __importDefault(require("joi"));
const router = express_1.default.Router();
// Rate limiting configurations
const readRateLimit = rateLimiter_1.createRateLimiter.read(); // 200 requests per 15 minutes
const writeRateLimit = rateLimiter_1.createRateLimiter.api(); // 100 requests per 15 minutes
const profileRateLimit = (0, rateLimiter_1.rateLimiter)(50, 15 * 60 * 1000); // 50 requests per 15 minutes
// Validation schemas for user profile operations
const createProfileSchema = joi_1.default.object({
    name: joi_1.default.string().min(1).max(100).required()
        .messages({
        'string.empty': 'Name is required',
        'string.max': 'Name cannot exceed 100 characters',
    }),
    email: joi_1.default.string().email().required()
        .messages({
        'string.email': 'Valid email is required',
    }),
});
const updateProfileByIdSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(100).optional()
        .messages({
        'string.empty': 'Name cannot be empty',
        'string.max': 'Name cannot exceed 100 characters',
    }),
    settings: joi_1.default.object({
        currency: joi_1.default.string().valid('USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR').optional(),
        theme: joi_1.default.string().valid('light', 'dark', 'system').optional(),
        notifications: joi_1.default.object({
            email: joi_1.default.boolean().optional(),
            push: joi_1.default.boolean().optional(),
            monthlyReport: joi_1.default.boolean().optional(),
            budgetAlerts: joi_1.default.boolean().optional(),
        }).optional(),
    }).optional(),
}).min(1).messages({
    'object.min': 'At least one field to update is required',
});
const updateCategoriesSchema = joi_1.default.object({
    categories: joi_1.default.array()
        .items(joi_1.default.string().trim().min(1).max(50))
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
const userIdParamsSchema = joi_1.default.object({
    userId: joi_1.default.string().trim().min(1).max(128).required()
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
router.get('/profile', readRateLimit, auth_1.auth, users_1.getUserProfile);
/**
 * @route   PUT /api/users/profile
 * @desc    Update current user's profile
 * @access  Private (requires authentication)
 */
router.put('/profile', writeRateLimit, auth_1.auth, (0, validation_1.validate)(schemas_1.updateUserSchema), users_1.updateUserProfile);
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
router.post('/', auth_1.auth, profileRateLimit, (0, validation_1.validate)(createProfileSchema), usersProfileController_1.default.createUserProfile);
/**
 * @route   GET /api/users/:userId
 * @desc    Get user profile by ID
 * @access  Private (owner only)
 */
router.get('/:userId', auth_1.auth, profileRateLimit, (0, validation_1.validateParams)(userIdParamsSchema), usersProfileController_1.default.getUserProfile);
/**
 * @route   PUT /api/users/:userId
 * @desc    Update user profile by ID
 * @access  Private (owner only)
 * @body    { name?: string, settings?: object }
 */
router.put('/:userId', auth_1.auth, profileRateLimit, (0, validation_1.validateParams)(userIdParamsSchema), (0, validation_1.validate)(updateProfileByIdSchema), usersProfileController_1.default.updateUserProfile);
/**
 * @route   GET /api/users/:userId/categories
 * @desc    Get user's custom expense categories
 * @access  Private (owner only)
 */
router.get('/:userId/categories', auth_1.auth, profileRateLimit, (0, validation_1.validateParams)(userIdParamsSchema), usersProfileController_1.default.getUserCategories);
/**
 * @route   PUT /api/users/:userId/categories
 * @desc    Update user's custom expense categories
 * @access  Private (owner only)
 * @body    { categories: string[] }
 */
router.put('/:userId/categories', auth_1.auth, profileRateLimit, (0, validation_1.validateParams)(userIdParamsSchema), (0, validation_1.validate)(updateCategoriesSchema), usersProfileController_1.default.updateUserCategories);
exports.default = router;
