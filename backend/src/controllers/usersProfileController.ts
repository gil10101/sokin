/**
 * User Profile Controller
 * 
 * Handles user profile operations including:
 * - User registration (profile creation)
 * - Profile retrieval by ID
 * - Profile updates
 * - User preferences/settings management
 * 
 * All endpoints require Firebase Authentication.
 * Users can only access and modify their own profile data.
 * 
 * @module controllers/usersProfileController
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache from '../utils/cache';
import { userProfileCacheKey } from './users';

/** Cache TTL for user profile data in seconds */
const USER_PROFILE_CACHE_TTL = 300; // 5 minutes

/**
 * User profile data structure
 */
interface UserProfile {
  name: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
  settings: {
    currency: string;
    theme: string;
    notifications: {
      email: boolean;
      push: boolean;
      monthlyReport: boolean;
      budgetAlerts: boolean;
      expenseNotifications: boolean;
    };
  };
}

/**
 * Default user settings
 */
const DEFAULT_SETTINGS = {
  currency: 'USD',
  theme: 'dark',
  notifications: {
    email: true,
    push: true,
    monthlyReport: true,
    budgetAlerts: true,
    expenseNotifications: true,
  },
};

/**
 * Default expense categories
 */
const DEFAULT_CATEGORIES = [
  'Dining',
  'Shopping',
  'Transport',
  'Utilities',
  'Entertainment',
  'Health',
  'Travel',
  'Other',
];

/**
 * Get user profile by ID
 * 
 * @route GET /api/users/:userId
 * @security Bearer token required
 * @param userId - User ID from route params
 * @returns User profile data
 */
export const getUserProfile = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Validate authentication
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: Authentication required', 401, true);
    }

    // Security: Users can only access their own profile
    if (req.user.uid !== userId) {
      logger.warn('Unauthorized profile access attempt', {
        requestedUserId: userId,
        authenticatedUserId: req.user.uid,
        ip: req.ip,
      });
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Check cache first
    const cacheKey = userProfileCacheKey(userId);
    const cachedProfile = await cache.getAsync<{ success: boolean; data: UserProfile }>(cacheKey);
    if (cachedProfile) {
      res.status(200).json(cachedProfile);
      return;
    }

    // Fetch from Firestore
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new AppError('User profile not found', 404, true);
    }

    const profileData = userDoc.data() as UserProfile;
    const result = { success: true, data: profileData };

    // Cache the profile
    await cache.setAsync(cacheKey, result, USER_PROFILE_CACHE_TTL);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.error('Error fetching user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.userId,
    });

    next(new AppError('Failed to fetch user profile', 500, false));
  }
};

/**
 * Create user profile during registration
 * 
 * @route POST /api/users
 * @security Bearer token required
 * @param name - User's display name
 * @param email - User's email address
 * @returns Created user profile
 */
export const createUserProfile = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Validate authentication
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: Authentication required', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const { name, email } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Name is required', 400, true);
    }

    // Validate email format with a robust regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      throw new AppError('Valid email is required', 400, true);
    }

    const userId = req.user.uid;

    // Check if profile already exists
    const existingDoc = await db.collection('users').doc(userId).get();
    if (existingDoc.exists) {
      throw new AppError('User profile already exists', 409, true);
    }

    // Create profile data
    const profileData: UserProfile = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
      settings: DEFAULT_SETTINGS,
    };

    // Create user document and default categories atomically
    const batch = db.batch();
    const userRef = db.collection('users').doc(userId);
    const categoriesRef = userRef.collection('categories').doc('default');
    
    batch.set(userRef, profileData);
    batch.set(categoriesRef, { categories: DEFAULT_CATEGORIES });

    await batch.commit();

    // Log without PII to comply with privacy regulations (GDPR, CCPA)
    logger.info('User profile created', { userId });

    res.status(201).json({
      success: true,
      data: profileData,
      message: 'User profile created successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.error('Error creating user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.uid,
    });

    next(new AppError('Failed to create user profile', 500, false));
  }
};

/**
 * Update user profile
 * 
 * @route PUT /api/users/:userId
 * @security Bearer token required
 * @param userId - User ID from route params
 * @returns Updated user profile
 */
export const updateUserProfile = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Validate authentication
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: Authentication required', 401, true);
    }

    // Security: Users can only update their own profile
    if (req.user.uid !== userId) {
      logger.warn('Unauthorized profile update attempt', {
        requestedUserId: userId,
        authenticatedUserId: req.user.uid,
        ip: req.ip,
      });
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Fetch existing profile
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new AppError('User profile not found', 404, true);
    }

    const existingData = userDoc.data() as UserProfile;

    // Build update object with only allowed fields
    const { name, email, settings } = req.body;
    const updateData: Partial<UserProfile> & { updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };

    // Validate and update name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new AppError('Name must be a non-empty string', 400, true);
      }
      updateData.name = name.trim();
    }

    // Validate and update email
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        throw new AppError('Valid email is required', 400, true);
      }
      updateData.email = email.trim().toLowerCase();
    }

    // Validate and update settings
    if (settings !== undefined) {
      if (typeof settings !== 'object' || settings === null) {
        throw new AppError('Settings must be an object', 400, true);
      }

      const newSettings = { ...existingData.settings };

      // Update currency
      if (settings.currency !== undefined) {
        const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR'];
        if (!validCurrencies.includes(settings.currency)) {
          throw new AppError(`Invalid currency. Allowed: ${validCurrencies.join(', ')}`, 400, true);
        }
        newSettings.currency = settings.currency;
      }

      // Update theme
      if (settings.theme !== undefined) {
        const validThemes = ['light', 'dark', 'system'];
        if (!validThemes.includes(settings.theme)) {
          throw new AppError(`Invalid theme. Allowed: ${validThemes.join(', ')}`, 400, true);
        }
        newSettings.theme = settings.theme;
      }

      // Update notification settings
      if (settings.notifications !== undefined) {
        if (typeof settings.notifications !== 'object' || settings.notifications === null) {
          throw new AppError('Notifications must be an object', 400, true);
        }

        const notificationFields = ['email', 'push', 'monthlyReport', 'budgetAlerts', 'expenseNotifications'] as const;
        for (const field of notificationFields) {
          if (settings.notifications[field] !== undefined) {
            if (typeof settings.notifications[field] !== 'boolean') {
              throw new AppError(`Notification setting '${field}' must be a boolean`, 400, true);
            }
            newSettings.notifications[field] = settings.notifications[field];
          }
        }
      }

      updateData.settings = newSettings;
    }

    // Update the document
    await db.collection('users').doc(userId).update(updateData);

    // Invalidate cache
    await cache.delAsync(userProfileCacheKey(userId));

    // Return updated profile
    const updatedProfile = {
      ...existingData,
      ...updateData,
    };

    logger.info('User profile updated', { userId });

    res.status(200).json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.error('Error updating user profile', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.userId,
    });

    next(new AppError('Failed to update user profile', 500, false));
  }
};

/**
 * Get user's custom categories
 * 
 * @route GET /api/users/:userId/categories
 * @security Bearer token required
 * @returns User's expense categories
 */
export const getUserCategories = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Validate authentication
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: Authentication required', 401, true);
    }

    // Security: Users can only access their own categories
    if (req.user.uid !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    // Fetch categories
    const categoriesDoc = await db
      .collection('users')
      .doc(userId)
      .collection('categories')
      .doc('default')
      .get();

    if (!categoriesDoc.exists) {
      // Return default categories if none exist
      res.status(200).json({
        success: true,
        data: { categories: DEFAULT_CATEGORIES },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: categoriesDoc.data(),
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.error('Error fetching user categories', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.userId,
    });

    next(new AppError('Failed to fetch categories', 500, false));
  }
};

/**
 * Update user's custom categories
 * 
 * @route PUT /api/users/:userId/categories
 * @security Bearer token required
 * @param categories - Array of category strings
 * @returns Updated categories
 */
export const updateUserCategories = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    // Validate authentication
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: Authentication required', 401, true);
    }

    // Security: Users can only update their own categories
    if (req.user.uid !== userId) {
      throw new AppError('Forbidden: Access denied', 403, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const { categories } = req.body;

    // Validate categories
    if (!Array.isArray(categories)) {
      throw new AppError('Categories must be an array', 400, true);
    }

    if (categories.length === 0) {
      throw new AppError('At least one category is required', 400, true);
    }

    if (categories.length > 50) {
      throw new AppError('Maximum 50 categories allowed', 400, true);
    }

    // Validate each category
    const validCategories = categories
      .filter((cat): cat is string => typeof cat === 'string')
      .map(cat => cat.trim())
      .filter(cat => cat.length > 0 && cat.length <= 50);

    if (validCategories.length === 0) {
      throw new AppError('No valid categories provided', 400, true);
    }

    // Remove duplicates
    const uniqueCategories = [...new Set(validCategories)];

    // Update categories
    await db
      .collection('users')
      .doc(userId)
      .collection('categories')
      .doc('default')
      .set({ categories: uniqueCategories }, { merge: true });

    logger.info('User categories updated', { userId, count: uniqueCategories.length });

    res.status(200).json({
      success: true,
      data: { categories: uniqueCategories },
      message: 'Categories updated successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    logger.error('Error updating user categories', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.userId,
    });

    next(new AppError('Failed to update categories', 500, false));
  }
};

export default {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  getUserCategories,
  updateUserCategories,
};
