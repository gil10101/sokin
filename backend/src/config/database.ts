import { getFirestore, Transaction } from 'firebase-admin/firestore';

// Configure Firestore settings for better performance
const configureFirestore = () => {
  const db = getFirestore();
  
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

  } catch (error) {

  }

  return db;
};

// Export the configured Firestore instance
export const db = configureFirestore();

// Helper for transaction with retry logic
export const runTransaction = async (
  callback: (transaction: Transaction) => Promise<any>,
  maxRetries = 5,
  backoffMs = 300
): Promise<any> => {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await db.runTransaction(callback);
    } catch (error) {
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