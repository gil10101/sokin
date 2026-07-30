"use client"

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { userProfileAPI } from '@/lib/api'

/**
 * Hook for fetching the user's expense categories.
 * Falls back to DEFAULT_CATEGORIES when the user has no custom categories
 * or the fetch fails.
 */

// Default categories if we can't fetch from Firestore
export const DEFAULT_CATEGORIES = [
  "Dining",
  "Shopping",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Travel",
  "Housing",
  "Food",
  "Other",
]

interface CategoriesResult {
  categories: string[]
  isFallback: boolean
}

const FALLBACK_RESULT: CategoriesResult = {
  categories: DEFAULT_CATEGORIES,
  isFallback: true,
}

export function useCategories(): CategoriesResult {
  const { user } = useAuth()

  const { data } = useQuery<CategoriesResult>({
    queryKey: ['categories', user?.uid],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async () => {
      if (!user) {
        return FALLBACK_RESULT
      }

      try {
        const userCategories = await userProfileAPI.getCategories(user.uid)
        if (userCategories.length > 0) {
          return { categories: userCategories, isFallback: false }
        }
        return FALLBACK_RESULT
      } catch (error) {
        // Use default categories if there's an error
        return FALLBACK_RESULT
      }
    },
  })

  return data ?? FALLBACK_RESULT
}
