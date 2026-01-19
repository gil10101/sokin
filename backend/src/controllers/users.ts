/**
 * Users Controller
 * 
 * Handles user profile operations for the current authenticated user.
 * Uses /profile endpoint to operate on the authenticated user's data.
 * 
 * @module controllers/users
 */

import { Request, Response, NextFunction } from 'express';
import { db, auth } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache, { CACHE_TTL } from '../utils/cache';

/**
 * Build cache key for user profile
 */
function buildUserCacheKey(userId: string): string {
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
export const getUserProfile = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const userId = req.user.uid;
    const cacheKey = buildUserCacheKey(userId);
    
    // Try distributed cache first
    const cachedUser = await cache.getAsync<{ success: boolean; data: Record<string, unknown> }>(cacheKey);
    if (cachedUser) {
      res.status(200).json(cachedUser);
      return;
    }

    // Get user from database
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      // User document doesn't exist yet, get information from Firebase Auth
      if (!auth) {
        throw new AppError('Authentication service not initialized', 500, false);
      }
      
      try {
        const userRecord = await auth.getUser(userId);
        
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
        await db.collection('users').doc(userId).set(userData);
        
        const result = { success: true, data: userData };
        
        // Cache user data in distributed cache
        await cache.setAsync(cacheKey, result, CACHE_TTL.USER_SETTINGS);
        
        res.status(200).json(result);
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error fetching user from auth: ${errorMessage}`, { userId });
        throw new AppError('User not found', 404, true);
      }
    }

    const userData = {
      id: userDoc.id,
      ...userDoc.data()
    };
    
    const result = { success: true, data: userData };
      
    // Cache user data in distributed cache
    await cache.setAsync(cacheKey, result, CACHE_TTL.USER_SETTINGS);
      
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in getUserProfile: ${errorMessage}`, { userId: req.user?.uid });
    next(new AppError('Failed to fetch user profile', 500, false));
  }
};

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
export const updateUserProfile = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const userId = req.user.uid;
    const { displayName, photoURL, settings } = req.body;
    
    // Validate input fields to prevent data corruption and DoS
    if (displayName !== undefined) {
      if (typeof displayName !== 'string') {
        throw new AppError('Display name must be a string', 400, true);
      }
      if (displayName.length > 100) {
        throw new AppError('Display name cannot exceed 100 characters', 400, true);
      }
    }
    
    if (photoURL !== undefined) {
      if (typeof photoURL !== 'string') {
        throw new AppError('Photo URL must be a string', 400, true);
      }
      if (photoURL.length > 500) {
        throw new AppError('Photo URL cannot exceed 500 characters', 400, true);
      }
      // Basic URL validation
      if (photoURL && !/^https?:\/\/.+/.test(photoURL)) {
        throw new AppError('Photo URL must be a valid HTTP(S) URL', 400, true);
      }
    }
    
    if (settings !== undefined) {
      if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
        throw new AppError('Settings must be an object', 400, true);
      }
    }
    
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };
    
    if (displayName !== undefined) updateData.displayName = displayName.trim();
    if (photoURL !== undefined) updateData.photoURL = photoURL;
    if (settings !== undefined) updateData.settings = settings;

    // Update the user document
    await db.collection('users').doc(userId).update(updateData);
    
    // Clear cache from distributed cache
    await cache.delAsync(buildUserCacheKey(userId));
    
    // Get updated user data
    const updatedUserDoc = await db.collection('users').doc(userId).get();
    if (!updatedUserDoc.exists) {
      throw new AppError('User not found after update', 404, true);
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
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in updateUserProfile: ${errorMessage}`, { userId: req.user?.uid });
    next(new AppError('Failed to update user profile', 500, false));
  }
};
