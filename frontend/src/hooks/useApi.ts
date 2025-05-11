import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

/**
 * A hook for making API calls with loading and error state management
 */
export function useApi<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const execute = useCallback(
    async <R = T>(
      apiMethod: (...args: any[]) => Promise<R>,
      ...args: any[]
    ): Promise<R | null> => {
      // Reset state before starting a new request
      setIsLoading(true);
      setError(null);

      try {
        // Only allow API calls if user is authenticated
        if (!user) {
          throw new Error('User is not authenticated');
        }

        const result = await apiMethod(...args);
        setData(result as unknown as T);
        setIsLoading(false);
        return result;
      } catch (err) {
        const apiError: ApiError = 
          err instanceof Error 
            ? { message: err.message } 
            : { message: 'An unknown error occurred' };
            
        setError(apiError);
        setIsLoading(false);
        return null;
      }
    },
    [user]
  );

  const get = useCallback(
    <R = T>(endpoint: string, options?: Parameters<typeof api.get>[1]) => 
      execute<R>(api.get, endpoint, options),
    [execute]
  );

  const post = useCallback(
    <R = T>(endpoint: string, data: Record<string, unknown>, options?: Parameters<typeof api.post>[2]) => 
      execute<R>(api.post, endpoint, data, options),
    [execute]
  );

  const put = useCallback(
    <R = T>(endpoint: string, data: Record<string, unknown>, options?: Parameters<typeof api.put>[2]) => 
      execute<R>(api.put, endpoint, data, options),
    [execute]
  );

  const del = useCallback(
    <R = T>(endpoint: string, options?: Parameters<typeof api.delete>[1]) => 
      execute<R>(api.delete, endpoint, options),
    [execute]
  );

  const patch = useCallback(
    <R = T>(endpoint: string, data: Record<string, unknown>, options?: Parameters<typeof api.patch>[2]) => 
      execute<R>(api.patch, endpoint, data, options),
    [execute]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    get,
    post,
    put,
    delete: del,
    patch,
    reset,
  };
} 