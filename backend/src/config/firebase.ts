import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin with the service account
const initializeFirebaseAdmin = () => {
  try {
    // Check if Firebase Admin is already initialized
    if (getApps().length === 0) {
      // Get Firebase service account from environment variable if available
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : undefined;

      if (serviceAccount) {
        const app = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        
        logger.info('Firebase Admin initialized successfully');
        return app;
      } else {
        logger.warn('Firebase service account not found. Some functionality may be limited.');
        return null;
      }
    } else {
      logger.info('Firebase Admin already initialized');
      return getApps()[0];
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error initializing Firebase Admin: ${error.message}`, { stack: error.stack });
    } else {
      logger.error('Unknown error initializing Firebase Admin');
    }
    return null;
  }
};

// Initialize Firebase Admin
const app = initializeFirebaseAdmin();

// Export Firebase Admin services
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Configure Firestore settings for better performance
if (db) {
  try {
    db.settings({
      ignoreUndefinedProperties: true,
      // Batch size for batch operations
      maximumBatchSize: 500,
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error configuring Firestore: ${error.message}`);
    }
  }
} 