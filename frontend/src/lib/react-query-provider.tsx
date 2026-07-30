'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

interface ReactQueryClientProviderProps {
  children: ReactNode
}

export function ReactQueryClientProvider({ children }: ReactQueryClientProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 60 * 60 * 1000, // 60 minutes
            retry: 2,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchInterval: false,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}