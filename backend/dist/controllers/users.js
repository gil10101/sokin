"use strict";
/**
 * Users Controller
 *
 * Handles user profile operations for the current authenticated user.
 * Uses /profile endpoint to operate on the authenticated user's data.
 *
 * @module controllers/users
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfile = exports.getUserProfile = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importStar(require("../utils/cache"));
/**
 * Build cache key for user profile
 */
function buildUserCacheKey(userId) {
    return `user:${userId}:profile`;
}
/**
 * Get user profile for the authenticated user
 *
 * @description Fetches the profile for the currently authenticated user.
 * If no profile exists, creates one from Firebase Auth data.
 * Results are cached in distributed cache.
 *
 * @param req - Express request with authenticated user
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns User profile data
 *
 * @example
 * GET /api/users/profile
 * Response: { data: { uid, email, displayName, ... } }
 */
const getUserProfile = async (req, res, next) => {
    var _a;
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userId = req.user.uid;
        const cacheKey = buildUserCacheKey(userId);
        // Try distributed cache first
        const cachedUser = await cache_1.default.getAsync(cacheKey);
        if (cachedUser) {
            res.status(200).json(cachedUser);
            return;
        }
        // Get user from database
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            // User document doesn't exist yet, get information from Firebase Auth
            if (!firebase_1.auth) {
                throw new errorHandler_1.AppError('Authentication service not initialized', 500, false);
            }
            try {
                const userRecord = await firebase_1.auth.getUser(userId);
                // Create minimal user object with consistent id field
                const userData = {
                    id: userId, // Include id for consistent API response structure
                    uid: userId,
                    email: userRecord.email || '',
                    displayName: userRecord.displayName || '',
                    photoURL: userRecord.photoURL || '',
                    createdAt: new Date().toISOString(),
                };
                // Create the user document
                await firebase_1.db.collection('users').doc(userId).set(userData);
                const result = { success: true, data: userData };
                // Cache user data in distributed cache
                await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.USER_SETTINGS);
                res.status(200).json(result);
                return;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger_1.default.error(`Error fetching user from auth: ${errorMessage}`, { userId });
                throw new errorHandler_1.AppError('User not found', 404, true);
            }
        }
        const userData = {
            id: userDoc.id,
            ...userDoc.data()
        };
        const result = { success: true, data: userData };
        // Cache user data in distributed cache
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.USER_SETTINGS);
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in getUserProfile: ${errorMessage}`, { userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid });
        next(new errorHandler_1.AppError('Failed to fetch user profile', 500, false));
    }
};
exports.getUserProfile = getUserProfile;
/**
 * Update user profile for the authenticated user
 *
 * @description Updates the profile for the currently authenticated user.
 * Invalidates cache after successful update.
 *
 * @param req - Express request with authenticated user and update data in body
 * @param res - Express response
 * @param next - Express next function for error propagation
 * @returns Updated user profile data
 *
 * @example
 * PUT /api/users/profile
 * Body: { displayName: "New Name", settings: { theme: "dark" } }
 * Response: { data: { ... }, message: "User profile updated successfully" }
 */
const updateUserProfile = async (req, res, next) => {
    var _a;
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const userId = req.user.uid;
        const { displayName, photoURL, settings } = req.body;
        // Validate input fields to prevent data corruption and DoS
        if (displayName !== undefined) {
            if (typeof displayName !== 'string') {
                throw new errorHandler_1.AppError('Display name must be a string', 400, true);
            }
            if (displayName.length > 100) {
                throw new errorHandler_1.AppError('Display name cannot exceed 100 characters', 400, true);
            }
        }
        if (photoURL !== undefined) {
            if (typeof photoURL !== 'string') {
                throw new errorHandler_1.AppError('Photo URL must be a string', 400, true);
            }
            if (photoURL.length > 500) {
                throw new errorHandler_1.AppError('Photo URL cannot exceed 500 characters', 400, true);
            }
            // Basic URL validation
            if (photoURL && !/^https?:\/\/.+/.test(photoURL)) {
                throw new errorHandler_1.AppError('Photo URL must be a valid HTTP(S) URL', 400, true);
            }
        }
        if (settings !== undefined) {
            if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
                throw new errorHandler_1.AppError('Settings must be an object', 400, true);
            }
        }
        // Build update object with only provided fields
        const updateData = {
            updatedAt: new Date().toISOString()
        };
        if (displayName !== undefined)
            updateData.displayName = displayName.trim();
        if (photoURL !== undefined)
            updateData.photoURL = photoURL;
        if (settings !== undefined)
            updateData.settings = settings;
        // Update the user document
        await firebase_1.db.collection('users').doc(userId).update(updateData);
        // Clear cache from distributed cache
        await cache_1.default.delAsync(buildUserCacheKey(userId));
        // Get updated user data
        const updatedUserDoc = await firebase_1.db.collection('users').doc(userId).get();
        if (!updatedUserDoc.exists) {
            throw new errorHandler_1.AppError('User not found after update', 404, true);
        }
        const userData = {
            id: updatedUserDoc.id,
            ...updatedUserDoc.data()
        };
        res.status(200).json({
            success: true,
            data: userData,
            message: 'User profile updated successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in updateUserProfile: ${errorMessage}`, { userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid });
        next(new errorHandler_1.AppError('Failed to update user profile', 500, false));
    }
};
exports.updateUserProfile = updateUserProfile;
