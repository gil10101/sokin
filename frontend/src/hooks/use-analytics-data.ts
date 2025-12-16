"use client"

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/auth-context'
import { api } from '../lib/api'

/**
 * Hook for fetching and processing analytics data via the backend API
 * Provides summary statistics for dashboard cards and charts
 */

export interface AnalyticsExpense {
  id: string
  name?: string
  amount: number
  date: string | number | Date | { toDate: () => Date }
  category: string
  description?: string
  userId: string
}

interface AnalyticsSummary {
  totalExpense: number
  monthlyAverage: number
  totalTransactions: number
  highestCategory: string
  highestCategoryAmount: number
}

interface MonthlyData {
  month: string
  amount: number
  count?: number
}

interface CategoryData {
  category: string
  amount: number
  count?: number
  percentage?: number
}

interface AnalyticsData {
  monthlyData: MonthlyData[]
  categoryData: CategoryData[]
  expenses: AnalyticsExpense[]
  summary: AnalyticsSummary
}

interface AnalyticsApiResponse {
  success: boolean
  data: {
    monthlyData: MonthlyData[]
    categoryData: CategoryData[]
    summary: AnalyticsSummary
    timeframe: string
    dateRange: {
      start: string
      end: string
    }
  }
}

interface UseAnalyticsDataOptions {
  timeframe: '3months' | '6months' | '12months'
}

export function useAnalyticsData({ timeframe }: UseAnalyticsDataOptions) {
  const { user } = useAuth()

  return useQuery<AnalyticsData>({
    queryKey: ['analytics', user?.uid, timeframe],
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter than regular expenses data
    gcTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      if (!user) {
        return {
          monthlyData: [],
          categoryData: [],
          expenses: [],
          summary: {
            totalExpense: 0,
            monthlyAverage: 0,
            totalTransactions: 0,
            highestCategory: 'N/A',
            highestCategoryAmount: 0
          }
        }
      }

      const response = await api.get<AnalyticsApiResponse>(
        `expenses/analytics?timeframe=${timeframe}`
      )

      // Verify response success before accessing data
      if (!response.success) {
        return {
          monthlyData: [],
          categoryData: [],
          expenses: [],
          summary: {
            totalExpense: 0,
            monthlyAverage: 0,
            totalTransactions: 0,
            highestCategory: 'N/A',
            highestCategoryAmount: 0
          }
        }
      }

      // Map the API response to the expected format
      const data = response.data

      return {
        monthlyData: data.monthlyData || [],
        categoryData: data.categoryData || [],
        expenses: [], // Analytics endpoint doesn't return raw expenses
        summary: data.summary || {
          totalExpense: 0,
          monthlyAverage: 0,
          totalTransactions: 0,
          highestCategory: 'N/A',
          highestCategoryAmount: 0
        }
      }
    },
  })
}
