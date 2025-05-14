"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfile = exports.getUserProfile = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importDefault(require("../utils/cache"));
// Get user profile
const getUserProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, true);
        }
        const userId = req.user.uid;
        const cacheKey = `user_${userId}`;
        // Try to get from cache first
        const cachedUser = cache_1.default.get(cacheKey);
        if (cachedUser) {
            res.status(200).json({ data: cachedUser });
            return;
        }
        // Get user from database
        const userDoc = await firebase_1.db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            // User document doesn't exist yet, get information from Firebase Auth
            if (!firebase_1.auth) {
                throw new errorHandler_1.AppError('Authentication service not initialized', 500, true);
            }
            try {
                const userRecord = await firebase_1.auth.getUser(userId);
                // Create minimal user object
                const userData = {
                    uid: userId,
                    email: userRecord.email || '',
                    displayName: userRecord.displayName || '',
                    photoURL: userRecord.photoURL || '',
                    createdAt: new Date().toISOString(),
                };
                // Create the user document
                await firebase_1.db.collection('users').doc(userId).set(userData);
                // Cache user data (60 seconds)
                cache_1.default.set(cacheKey, userData, 60);
                res.status(200).json({ data: userData });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger_1.default.error(`Error fetching user from auth: ${errorMessage}`, { userId });
                throw new errorHandler_1.AppError('User not found', 404, true);
            }
        }
        else {
            const userData = {
                id: userDoc.id,
                ...userDoc.data()
            };
            // Cache user data (60 seconds)
            cache_1.default.set(cacheKey, userData, 60);
            res.status(200).json({ data: userData });
        }
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in getUserProfile: ${errorMessage}`);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};
exports.getUserProfile = getUserProfile;
// Update user profile
const updateUserProfile = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, true);
        }
        const userId = req.user.uid;
        const { displayName, photoURL, settings } = req.body;
        // Build update object with only provided fields
        const updateData = {};
        if (displayName !== undefined)
            updateData.displayName = displayName;
        if (photoURL !== undefined)
            updateData.photoURL = photoURL;
        if (settings !== undefined)
            updateData.settings = settings;
        updateData.updatedAt = new Date().toISOString();
        // Update the user document
        await firebase_1.db.collection('users').doc(userId).update(updateData);
        // Clear cache
        cache_1.default.del(`user_${userId}`);
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
            data: userData,
            message: 'User profile updated successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in updateUserProfile: ${errorMessage}`);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
};
exports.updateUserProfile = updateUserProfile;
