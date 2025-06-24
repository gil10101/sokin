"use strict";
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
exports.storage = exports.db = exports.auth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const dotenv = __importStar(require("dotenv"));
const logger_1 = __importDefault(require("../utils/logger"));
// Load environment variables
dotenv.config();
// Initialize Firebase Admin with the service account
const initializeFirebaseAdmin = () => {
    try {
        // Check if Firebase Admin is already initialized
        if ((0, app_1.getApps)().length === 0) {
            // Check if we have individual service account credentials in environment variables
            const hasServiceAccountEnvVars = process.env.FIREBASE_PRIVATE_KEY &&
                process.env.FIREBASE_CLIENT_EMAIL &&
                process.env.FIREBASE_PROJECT_ID;
            if (hasServiceAccountEnvVars) {
                // Construct service account from individual environment variables
                const serviceAccount = {
                    type: "service_account",
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    client_id: process.env.FIREBASE_CLIENT_ID,
                    auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
                    token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
                    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
                    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
                };
                const app = (0, app_1.initializeApp)({
                    credential: (0, app_1.cert)(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
                });
                logger_1.default.info('Firebase Admin initialized with service account from environment variables');
                return app;
            }
            // Fallback: Check for service account JSON string
            const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
            if (serviceAccountJson) {
                const serviceAccount = JSON.parse(serviceAccountJson);
                const app = (0, app_1.initializeApp)({
                    credential: (0, app_1.cert)(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID || 'personalexpensetracker-ff87a',
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'personalexpensetracker-ff87a.firebasestorage.app',
                });
                logger_1.default.info('Firebase Admin initialized with service account JSON');
                return app;
            }
            // Development mode fallback
            if (process.env.NODE_ENV === 'development' || process.env.FIRESTORE_EMULATOR_HOST) {
                const app = (0, app_1.initializeApp)({
                    projectId: process.env.FIREBASE_PROJECT_ID || 'personalexpensetracker-ff87a',
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'personalexpensetracker-ff87a.firebasestorage.app',
                });
                logger_1.default.info('Firebase Admin initialized in development mode');
                return app;
            }
            logger_1.default.error('No valid Firebase credentials found');
            throw new Error('Firebase credentials not configured');
        }
        else {
            logger_1.default.info('Firebase Admin already initialized');
            return (0, app_1.getApps)()[0];
        }
    }
    catch (error) {
        if (error instanceof Error) {
            logger_1.default.error(`Error initializing Firebase Admin: ${error.message}`, { stack: error.stack });
        }
        else {
            logger_1.default.error('Unknown error initializing Firebase Admin');
        }
        return null;
    }
};
// Initialize Firebase Admin
const app = initializeFirebaseAdmin();
// Export Firebase Admin services
exports.auth = app ? (0, auth_1.getAuth)(app) : null;
exports.db = app ? (0, firestore_1.getFirestore)(app) : null;
exports.storage = app ? (0, storage_1.getStorage)(app) : null;
// Configure Firestore settings for better performance
if (exports.db) {
    try {
        exports.db.settings({
            ignoreUndefinedProperties: true,
            // Batch size for batch operations
            maximumBatchSize: 500,
        });
        logger_1.default.info('Firestore settings configured successfully');
    }
    catch (error) {
        if (error instanceof Error) {
            logger_1.default.error(`Error configuring Firestore: ${error.message}`);
        }
    }
}
else {
    logger_1.default.error('Failed to initialize Firestore - db is null');
}
