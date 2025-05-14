import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

/**
 * API client for making authenticated requests to the backend
 */
export async function apiClient<T = any>(
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

    const response = await fetch(`${API_BASE_URL}/${endpoint}`, config);
    
    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
      return Promise.reject(new Error(errorData.message || `Error ${response.status}: ${response.statusText}`));
    }
    
    // Parse and return the response data
    const data = await response.json();
    return data;
  } catch (error) {
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
  get: <T = any>(endpoint: string, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T = any>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'POST', data }),
  
  put: <T = any>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'PUT', data }),
  
  delete: <T = any>(endpoint: string, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
  
  patch: <T = any>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'PATCH', data }),
}; 