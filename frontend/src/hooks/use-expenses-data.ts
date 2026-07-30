"use client"

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { api } from '@/lib/api'
import { logger } from '@/lib/logger'

export interface Expense {
  id: string
  name: string
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
  /** Fetch exactly this many most-recent expenses in a single request */
  limit?: number
  /**
   * How far back to fetch when paging. Every chart in the app renders at
   * most a rolling year, so the default bounds the request set instead of
   * walking the user's entire history.
   */
  months?: number
}

/** Backend caps a page at 100; 6 pages covers 600 expenses in the window. */
const PAGE_SIZE = 100
const MAX_PAGES = 6
const DEFAULT_MONTHS = 12

/**
 * Hook for fetching expenses via the backend API
 * Replaces direct Firestore access for better architecture
 */
export function useExpensesData(options: UseExpensesOptions = {}) {
  const { user } = useAuth()
  const months = options.months ?? DEFAULT_MONTHS

  return useQuery<Expense[]>({
    queryKey: ['expenses', user?.uid, options.limit ?? null, months],
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

      const since = new Date()
      since.setMonth(since.getMonth() - months)

      const items: Expense[] = []
      let cursor: string | null = null
      let hasMore = true
      let pageCount = 0

      while (hasMore && pageCount < MAX_PAGES) {
        const params = new URLSearchParams()
        params.set('limit', String(PAGE_SIZE))
        params.set('startDate', since.toISOString())
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

      if (hasMore) {
        logger.warn('Expense history truncated', {
          fetched: items.length,
          months,
        })
      }

      return normalizeExpenses(items)
    },
  })
}
