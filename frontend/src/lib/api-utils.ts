export async function checkBackendConnectivity(): Promise<boolean> {
  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    if (!API_BASE_URL) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured');
    }
    const HEALTH_ENDPOINT = `${API_BASE_URL.replace(/\/api\/?$/, '')}/health`;
    
    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Backend health check failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    return false;
  }
}

export function setupConnectivityMonitoring(intervalMs = 30000): () => void {
  let lastStatus = true;
  
  const checkInterval = setInterval(async () => {
    const isConnected = await checkBackendConnectivity();
    
    // Only on status change
    if (lastStatus && !isConnected) {
      try {
        const { toast } = await import('../hooks/use-toast');
        toast({
          variant: 'destructive',
          title: 'Connection Issue',
          description: 'The server is currently unavailable. Some features may not work.',
        });
      } catch (error) {
        console.warn('Toast failed to load:', error);
      }
    } else if (!lastStatus && isConnected) {
      try {
        const { toast } = await import('../hooks/use-toast');
        toast({
          title: 'Connection Restored',
          description: 'The server connection has been restored.',
        });
      } catch (error) {
        console.warn('Toast failed to load:', error);
      }
    }
    
    lastStatus = isConnected;
  }, intervalMs);
  
  return () => clearInterval(checkInterval);
}

export function validateEnvironmentVariables(): string[] {
  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_API_URL',
  ];
  
  return requiredVars.filter(varName => !process.env[varName]);
}

export function checkApplicationConfiguration(): { valid: boolean; missingVars: string[] } {
  const missingVars = validateEnvironmentVariables();
  
  return {
    valid: missingVars.length === 0,
    missingVars,
  };
} 