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
exports.db = exports.auth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const dotenv = __importStar(require("dotenv"));
const logger_1 = __importDefault(require("../utils/logger"));
// Load environment variables
dotenv.config();
// Initialize Firebase Admin with the service account
const initializeFirebaseAdmin = () => {
    try {
        // Check if Firebase Admin is already initialized
        if ((0, app_1.getApps)().length === 0) {
            // Get Firebase service account from environment variable if available
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
                : undefined;
            if (serviceAccount) {
                const app = (0, app_1.initializeApp)({
                    credential: (0, app_1.cert)(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
                });
                logger_1.default.info('Firebase Admin initialized successfully');
                return app;
            }
            else {
                logger_1.default.warn('Firebase service account not found. Some functionality may be limited.');
                return null;
            }
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
// Configure Firestore settings for better performance
if (exports.db) {
    try {
        exports.db.settings({
            ignoreUndefinedProperties: true,
            // Batch size for batch operations
            maximumBatchSize: 500,
        });
    }
    catch (error) {
        if (error instanceof Error) {
            logger_1.default.error(`Error configuring Firestore: ${error.message}`);
        }
    }
}
