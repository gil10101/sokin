import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as dotenv from 'dotenv';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin with the service account
const initializeFirebaseAdmin = () => {
  try {
    // Check if Firebase Admin is already initialized
    if (getApps().length === 0) {
      
      // Check if we have individual service account credentials in environment variables
      const hasServiceAccountEnvVars = process.env.FIREBASE_PRIVATE_KEY && 
                                      process.env.FIREBASE_CLIENT_EMAIL && 
                                      process.env.FIREBASE_PROJECT_ID;

      if (hasServiceAccountEnvVars) {
        // Construct service account from individual environment variables
        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID!,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID!,
          private_key: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL!,
          client_id: process.env.FIREBASE_CLIENT_ID!,
          auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
          token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL!
        };

        const app = initializeApp({
          credential: cert(serviceAccount as ServiceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
        });
        
        logger.info('Firebase Admin initialized with service account from environment variables');
        return app;
      }

      // Fallback: Check for service account JSON string
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        const app = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });

        if (!process.env.FIREBASE_PROJECT_ID) {
          throw new Error('FIREBASE_PROJECT_ID environment variable is not configured');
        }
        if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
          throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not configured');
        }
        
        logger.info('Firebase Admin initialized with service account JSON');
        return app;
      }

      // Development mode fallback
      if (process.env.NODE_ENV === 'development' || process.env.FIRESTORE_EMULATOR_HOST) {
        if (!process.env.FIREBASE_PROJECT_ID) {
          throw new Error('FIREBASE_PROJECT_ID environment variable is not configured');
        }
        if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
          throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not configured');
        }

        const app = initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });

        logger.info('Firebase Admin initialized in development mode');
        return app;
      }

      logger.error('No valid Firebase credentials found');
      throw new Error('Firebase credentials not configured');
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
export const storage = app ? getStorage(app) : null;

// Configure Firestore settings for better performance
if (db) {
  try {
    db.settings({
      ignoreUndefinedProperties: true,
      // Batch size for batch operations
      maximumBatchSize: 500,
    });
    logger.info('Firestore settings configured successfully');
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Error configuring Firestore: ${error.message}`);
    }
  }
} else {
  logger.error('Failed to initialize Firestore - db is null');
} 