import { Request, Response } from 'express';
import { db, auth } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import cache from '../utils/cache';

// Get user profile
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, true);
    }

    const userId = req.user.uid;
    const cacheKey = `user_${userId}`;
    
    // Try to get from cache first
    const cachedUser = cache.get(cacheKey);
    if (cachedUser) {
      res.status(200).json({ data: cachedUser });
      return;
    }

    // Get user from database
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      // User document doesn't exist yet, get information from Firebase Auth
      if (!auth) {
        throw new AppError('Authentication service not initialized', 500, true);
      }
      
      try {
        const userRecord = await auth.getUser(userId);
        
        // Create minimal user object
        const userData = {
          uid: userId,
          email: userRecord.email || '',
          displayName: userRecord.displayName || '',
          photoURL: userRecord.photoURL || '',
          createdAt: new Date().toISOString(),
        };
        
        // Create the user document
        await db.collection('users').doc(userId).set(userData);
        
        // Cache user data (60 seconds)
        cache.set(cacheKey, userData, 60);
        
        res.status(200).json({ data: userData });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error fetching user from auth: ${errorMessage}`, { userId });
        throw new AppError('User not found', 404, true);
      }
    } else {
      const userData = {
        id: userDoc.id,
        ...userDoc.data()
      };
      
      // Cache user data (60 seconds)
      cache.set(cacheKey, userData, 60);
      
      res.status(200).json({ data: userData });
    }
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in getUserProfile: ${errorMessage}`);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

// Update user profile
export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    if (!db) {
      throw new AppError('Database not initialized', 500, true);
    }

    const userId = req.user.uid;
    const { displayName, photoURL, settings } = req.body;
    
    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (photoURL !== undefined) updateData.photoURL = photoURL;
    if (settings !== undefined) updateData.settings = settings;
    updateData.updatedAt = new Date().toISOString();

    // Update the user document
    await db.collection('users').doc(userId).update(updateData);
    
    // Clear cache
    cache.del(`user_${userId}`);
    
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
      data: userData,
      message: 'User profile updated successfully'
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error in updateUserProfile: ${errorMessage}`);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
}; 