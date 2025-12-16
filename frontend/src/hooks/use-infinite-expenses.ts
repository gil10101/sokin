"use client"

import { useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/auth-context'
import { api } from '../lib/api'

export interface ExpenseLite {
  id: string
  name?: string
  amount: number
  date: string | Date
  category: string
  userId: string
}

interface ExpensesResponse {
  data: ExpenseLite[]
  pagination: {
    hasMore: boolean
    nextCursor: string | null
    count: number
  }
}

interface PageResult {
  docs: ExpenseLite[]
  nextCursor: string | null
}

/**
 * Hook for infinite scrolling expenses via the backend API
 * Uses cursor-based pagination for efficient data loading
 */
export function useInfiniteExpenses(pageSize = 25) {
  const { user } = useAuth()

  return useInfiniteQuery({
    queryKey: ['expenses-infinite', user?.uid, pageSize],
    enabled: !!user,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<PageResult> => {
      if (!user) return { docs: [], nextCursor: null }

      const params = new URLSearchParams()
      params.set('limit', pageSize.toString())
      
      if (pageParam) {
        params.set('cursor', pageParam as string)
      }

      const response = await api.get<ExpensesResponse>(`expenses?${params.toString()}`)
      
      return {
        docs: response.data || [],
        nextCursor: response.pagination?.nextCursor || null,
      }
    },
    getNextPageParam: (lastPage: PageResult) => lastPage.nextCursor,
    staleTime: 60_000,
  })
}
