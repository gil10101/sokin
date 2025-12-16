"use client"

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/auth-context'
import { api } from '../lib/api'

export interface Expense {
  id: string
  name?: string
  amount: number
  date: string | number | Date | { toDate: () => Date }
  category: string
  description?: string
  userId: string
}

interface ExpensesResponse {
  expenses?: Expense[]
  data?: Expense[]
  pagination?: {
    hasMore: boolean
    nextCursor: string | null
    count: number
  }
}

interface UseExpensesOptions {
  limit?: number
}

/**
 * Hook for fetching expenses via the backend API
 * Replaces direct Firestore access for better architecture
 */
export function useExpensesData(options: UseExpensesOptions = {}) {
  const { user } = useAuth()

  return useQuery<Expense[]>({
    queryKey: ['expenses', user?.uid, options.limit ?? null],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      if (!user) return []

      const params = new URLSearchParams()
      if (options.limit) {
        params.set('limit', options.limit.toString())
      }

      const endpoint = params.toString() 
        ? `expenses?${params.toString()}` 
        : 'expenses'

      const response = await api.get<ExpensesResponse>(endpoint)
      // Handle multiple possible response structures from the API
      return response.expenses || response.data || []
    },
  })
}
