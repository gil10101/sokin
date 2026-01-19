"use client"

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { api } from '@/lib/api'

export interface Expense {
  id: string
  name?: string
  amount: number
  date: string
  category: string
  description?: string
  userId: string
}

interface ExpensesResponse {
  success?: boolean
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

      const normalizeExpenses = (items: Expense[]) =>
        items.map((expense) => ({
          ...expense,
          description: expense.description ?? (expense as Expense & { notes?: string }).notes
        }))

      if (options.limit) {
        const params = new URLSearchParams()
        params.set('limit', options.limit.toString())

        const endpoint = `expenses?${params.toString()}`
        const response = await api.get<ExpensesResponse>(endpoint)
        return normalizeExpenses(response.data ?? [])
      }

      const items: Expense[] = []
      let cursor: string | null = null
      let hasMore = true
      let pageCount = 0

      while (hasMore && pageCount < 50) {
        const params = new URLSearchParams()
        params.set('limit', '100')
        if (cursor) {
          params.set('cursor', cursor)
        }

        const response = await api.get<ExpensesResponse>(`expenses?${params.toString()}`)
        const pageItems = response.data ?? []
        items.push(...pageItems)
        cursor = response.pagination?.nextCursor ?? null
        hasMore = response.pagination?.hasMore ?? false
        pageCount += 1
      }

      return normalizeExpenses(items)
    },
  })
}
