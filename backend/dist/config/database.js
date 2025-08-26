"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTransaction = exports.db = void 0;
const firestore_1 = require("firebase-admin/firestore");
// Configure Firestore settings for better performance
const configureFirestore = () => {
    const db = (0, firestore_1.getFirestore)();
    // Configure connection pool settings
    const settings = {
        // Min number of idle connections to maintain in the pool
        minConnectionsToMaintain: 1,
        // Max idle time for a connection before it's closed (10 min)
        maxIdleTime: 10 * 60 * 1000,
        // Fail fast if connection attempt takes longer than this (30s)
        maxConnectionTimeout: 30 * 1000,
        // Enable auto-retries on errors
        experimentalAutoDetectLongPolling: true,
        experimentalForceLongPolling: true,
    };
    try {
        db.settings(settings);
    }
    catch (error) {
    }
    return db;
};
// Export the configured Firestore instance
exports.db = configureFirestore();
// Helper for transaction with retry logic
const runTransaction = async (callback, maxRetries = 5, backoffMs = 300) => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await exports.db.runTransaction(callback);
        }
        catch (error) {
            attempt++;
            // If this was the last attempt, throw the error
            if (attempt >= maxRetries) {
                throw error;
            }
            // Wait before retrying, with exponential backoff
            const waitTime = backoffMs * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};
exports.runTransaction = runTransaction;
