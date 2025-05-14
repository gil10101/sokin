import { toast } from '../components/ui/use-toast';
import { logMessage } from './sentry';

/**
 * Check if the backend API is reachable
 * @returns Promise<boolean> True if backend is reachable, false otherwise
 */
export async function checkBackendConnectivity(): Promise<boolean> {
  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
    const HEALTH_ENDPOINT = `${API_BASE_URL.replace('/api', '')}/health`;
    
    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Use a short timeout to prevent long waits
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    if (error instanceof Error) {
      logMessage(`Backend connectivity check failed: ${error.message}`, 'warning');
    }
    return false;
  }
}

/**
 * Monitor backend connectivity and show toast alerts when there are issues
 */
export function setupConnectivityMonitoring(intervalMs = 30000): () => void {
  let lastStatus = true;
  
  const checkInterval = setInterval(async () => {
    const isConnected = await checkBackendConnectivity();
    
    // Only show notifications when the status changes
    if (lastStatus && !isConnected) {
      // Backend became unavailable
      toast({
        variant: 'destructive',
        title: 'Connection Issue',
        description: 'The server is currently unavailable. Some features may not work.',
      });
      logMessage('Backend connectivity lost', 'warning');
    } else if (!lastStatus && isConnected) {
      // Backend is available again
      toast({
        title: 'Connection Restored',
        description: 'The server connection has been restored.',
      });
      logMessage('Backend connectivity restored', 'info');
    }
    
    lastStatus = isConnected;
  }, intervalMs);
  
  // Return a cleanup function
  return () => clearInterval(checkInterval);
}

/**
 * Validate that all required environment variables are set
 * @returns An array of missing environment variables
 */
export function validateEnvironmentVariables(): string[] {
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_API_URL',
  ];
  
  return requiredVars.filter(varName => !process.env[varName]);
}

/**
 * Check if the application has a valid configuration
 */
export function checkApplicationConfiguration(): { valid: boolean; missingVars: string[] } {
  const missingVars = validateEnvironmentVariables();
  
  return {
    valid: missingVars.length === 0,
    missingVars,
  };
} 