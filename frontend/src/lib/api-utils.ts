import { toast } from '../components/ui/use-toast';

/**
 * Check if the backend API is reachable
 * @returns Promise<boolean> True if backend is reachable, false otherwise
 */
export async function checkBackendConnectivity(): Promise<boolean> {
  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    if (!API_BASE_URL) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured');
    }
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
    // Backend connectivity check failed
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
    } else if (!lastStatus && isConnected) {
      // Backend is available again
      toast({
        title: 'Connection Restored',
        description: 'The server connection has been restored.',
      });
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