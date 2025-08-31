import { auth } from './firebase';

// Performance monitoring for API calls
const apiMetrics = {
  requestCount: 0,
  totalResponseTime: 0,
  errors: 0,
};

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Expose metrics for debugging
  (window as Window & { apiMetrics?: typeof apiMetrics }).apiMetrics = apiMetrics;
}

// Ensure we always have a valid base URL
const getApiBaseUrl = (): string => {
  let baseUrl: string;

  if (typeof window !== 'undefined') {
    // Client side - use environment variable
    baseUrl = process.env.NEXT_PUBLIC_API_URL!;
    if (!baseUrl) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured');
    }
  } else {
    // Server side - use environment variable
    baseUrl = process.env.NEXT_PUBLIC_API_URL!;
    if (!baseUrl) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured');
    }
  }

  // Ensure the base URL always includes /api
  if (!baseUrl.endsWith('/api')) {
    baseUrl = baseUrl.replace(/\/$/, '') + '/api';
  }

  return baseUrl;
};

/**
 * API client for making authenticated requests to the backend
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  { data, token, headers, ...customConfig }: ApiClientOptions = {}
): Promise<T> {
  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    body: data ? JSON.stringify(data) : undefined,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...customConfig,
  };

  const startTime = performance.now();
  apiMetrics.requestCount++;

  try {
    // Get the current user's token if not provided
    if (!token && auth.currentUser) {
      token = await auth.currentUser.getIdToken();
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }

    const baseUrl = getApiBaseUrl();
    const finalUrl = `${baseUrl}/${endpoint}`;

    const response = await fetch(finalUrl, config);

    // Track response time
    const responseTime = performance.now() - startTime;
    apiMetrics.totalResponseTime += responseTime;

    // Handle HTTP errors
    if (!response.ok) {
      apiMetrics.errors++;
      const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
      // Backend sends error messages in 'error' field, not 'message'
      const errorMessage = errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`;
      return Promise.reject(new Error(errorMessage));
    }

    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
    apiMetrics.errors++;
    return Promise.reject(error);
  }
}

// API client options interface
interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  data?: Record<string, unknown>;
  token?: string;
}

// Convenience methods for different request types
export const api = {
  get: <T = unknown>(endpoint: string, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'POST', data }),

  put: <T = unknown>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'PUT', data }),

  delete: <T = unknown>(endpoint: string, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),

  patch: <T = unknown>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'PATCH', data }),
}; 