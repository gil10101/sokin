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
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.db = exports.auth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const dotenv = __importStar(require("dotenv"));
// Simple inline logger to avoid circular dependencies
const log = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta || '')
};
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
                log.info('Firebase Admin initialized with service account from environment variables');
                return app;
            }
            // Fallback: Check for service account JSON string
            const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
            if (serviceAccountJson) {
                const serviceAccount = JSON.parse(serviceAccountJson);
                const app = (0, app_1.initializeApp)({
                    credential: (0, app_1.cert)(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                });
                if (!process.env.FIREBASE_PROJECT_ID) {
                    throw new Error('FIREBASE_PROJECT_ID environment variable is not configured');
                }
                if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
                    throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not configured');
                }
                log.info('Firebase Admin initialized with service account JSON');
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
                const app = (0, app_1.initializeApp)({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
                });
                log.info('Firebase Admin initialized in development mode');
                return app;
            }
            log.error('No valid Firebase credentials found');
            throw new Error('Firebase credentials not configured');
        }
        else {
            log.info('Firebase Admin already initialized');
            return (0, app_1.getApps)()[0];
        }
    }
    catch (error) {
        if (error instanceof Error) {
            log.error(`Error initializing Firebase Admin: ${error.message}`, { stack: error.stack });
        }
        else {
            log.error('Unknown error initializing Firebase Admin');
        }
        return null;
    }
};
// Initialize Firebase Admin
let app = null;
let auth = null;
exports.auth = auth;
let db = null;
exports.db = db;
let storage = null;
exports.storage = storage;
try {
    app = initializeFirebaseAdmin();
    // Export Firebase Admin services
    exports.auth = auth = app ? (0, auth_1.getAuth)(app) : null;
    exports.db = db = app ? (0, firestore_1.getFirestore)(app) : null;
    exports.storage = storage = app ? (0, storage_1.getStorage)(app) : null;
}
catch (error) {
    console.error('[FIREBASE] Critical initialization error:', error);
    // Don't crash - allow the app to start without Firebase
}
// Configure Firestore settings for better performance
if (db) {
    try {
        db.settings({
            ignoreUndefinedProperties: true,
            // Batch size for batch operations
            maximumBatchSize: 500,
        });
        log.info('Firestore settings configured successfully');
    }
    catch (error) {
        if (error instanceof Error) {
            log.error(`Error configuring Firestore: ${error.message}`);
        }
    }
}
else {
    log.error('Failed to initialize Firestore - db is null');
}
