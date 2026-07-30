import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';

export function useApi<T = unknown>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user }, [user]);

  const execute = useCallback(
    async <R>(
      apiCall: () => Promise<R>
    ): Promise<R | null> => {
      setIsLoading(true);
      setError(null);

      try {
        if (!userRef.current) {
          throw new Error('User is not authenticated');
        }

        const result = await apiCall();
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
    []
  );

  const get = useCallback(
    <R = T>(endpoint: string, options?: Parameters<typeof api.get>[1]) =>
      execute<R>(() => api.get<R>(endpoint, options)),
    [execute]
  );

  const post = useCallback(
    <R = T>(endpoint: string, data: Record<string, unknown>, options?: Parameters<typeof api.post>[2]) =>
      execute<R>(() => api.post<R>(endpoint, data, options)),
    [execute]
  );

  const put = useCallback(
    <R = T>(endpoint: string, data: Record<string, unknown>, options?: Parameters<typeof api.put>[2]) =>
      execute<R>(() => api.put<R>(endpoint, data, options)),
    [execute]
  );

  const del = useCallback(
    <R = T>(endpoint: string, options?: Parameters<typeof api.delete>[1]) =>
      execute<R>(() => api.delete<R>(endpoint, options)),
    [execute]
  );

  const patch = useCallback(
    <R = T>(endpoint: string, data: Record<string, unknown>, options?: Parameters<typeof api.patch>[2]) =>
      execute<R>(() => api.patch<R>(endpoint, data, options)),
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
