import { Request, Response, NextFunction } from 'express';
import { auth as firebaseAuth } from '../config/firebase';
import { AppError } from './errorHandler';
import logger from '../utils/logger';

// Add a custom user property to the Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

// Authentication middleware
export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Unauthorized: No token provided', 401, true);
    }

    const token = authHeader.split(' ')[1];

    try {
      if (!firebaseAuth) {
        throw new AppError('Firebase auth not initialized', 500, false);
      }
      
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email
      };
      next();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error verifying token:', { error: errorMessage });
      throw new AppError('Unauthorized: Invalid token', 401, true);
    }
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      logger.error('Authentication error:', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}; 