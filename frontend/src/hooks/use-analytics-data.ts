"use client"

import { useQuery } from '@tanstack/react-query'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/auth-context'
import { dateCalc, safeParseDate, formatDate } from '../lib/date-utils'

/**
 * Hook for fetching and processing analytics data for clean summary cards
 * Provides summary statistics for top cards without requiring icon components
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

interface AnalyticsData {
  monthlyData: { month: string; amount: number }[]
  categoryData: { category: string; amount: number }[]
  expenses: AnalyticsExpense[]
  summary: AnalyticsSummary
}

interface UseAnalyticsDataOptions {
  timeframe: '3months' | '6months' | '12months'
}

export function useAnalyticsData({ timeframe }: UseAnalyticsDataOptions) {
  const { user } = useAuth()

  return useQuery<AnalyticsData>({
    queryKey: ['analytics', user?.uid, timeframe],
    enabled: !!user && !!db,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter than regular expenses data
    gcTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      if (!user || !db) {
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

      // Calculate date range based on timeframe
      const endDate = new Date()
      let startDate: Date

      switch (timeframe) {
        case "3months":
          startDate = dateCalc.subMonths(endDate, 3)
          break
        case "12months":
          startDate = dateCalc.subMonths(endDate, 12)
          break
        case "6months":
        default:
          startDate = dateCalc.subMonths(endDate, 6)
          break
      }

      // Convert to ISO strings for proper comparison (matching how dates are saved)
      const startDateISO = startDate.toISOString()
      const endDateISO = endDate.toISOString()

      // Query expenses within date range
      const expensesRef = collection(db, "expenses")
      const q = query(
        expensesRef,
        where("userId", "==", user.uid),
        where("date", ">=", startDateISO),
        where("date", "<=", endDateISO),
      )

      const querySnapshot = await getDocs(q)
      const expenses: AnalyticsExpense[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AnalyticsExpense[]

      // Process data for monthly trends
      const monthlyTrends: Record<string, number> = {}
      const categoryTotals: Record<string, number> = {}

      expenses.forEach((expense) => {
        const date = safeParseDate(expense.date)
        const monthYear = formatDate.monthYear(date)

        // Aggregate monthly data
        if (!monthlyTrends[monthYear]) {
          monthlyTrends[monthYear] = 0
        }
        monthlyTrends[monthYear] += expense.amount

        // Aggregate category data
        if (!categoryTotals[expense.category]) {
          categoryTotals[expense.category] = 0
        }
        categoryTotals[expense.category] += expense.amount
      })

      // Convert to array format for charts
      const monthlyDataArray = Object.entries(monthlyTrends).map(([month, amount]) => ({
        month,
        amount,
      }))

      const categoryDataArray = Object.entries(categoryTotals).map(([category, amount]) => ({
        category,
        amount,
      }))

      // Sort monthly data chronologically by parsing the month string deterministically
      const monthNameMap: Record<string, number> = {
        jan: 0, january: 0,
        feb: 1, february: 1,
        mar: 2, march: 2,
        apr: 3, april: 3,
        may: 4,
        jun: 5, june: 5,
        jul: 6, july: 6,
        aug: 7, august: 7,
        sep: 8, september: 8,
        oct: 9, october: 9,
        nov: 10, november: 10,
        dec: 11, december: 11
      }

      monthlyDataArray.sort((a, b) => {
        try {
          // Parse format like "Jan 2024" deterministically
          const [monthStrA, yearStrA] = a.month.trim().split(' ')
          const [monthStrB, yearStrB] = b.month.trim().split(' ')
          
          const monthA = monthNameMap[monthStrA.toLowerCase()]
          const monthB = monthNameMap[monthStrB.toLowerCase()]
          const yearA = parseInt(yearStrA, 10)
          const yearB = parseInt(yearStrB, 10)
          
          // If parsing fails, treat as minimal sentinel (early date)
          if (isNaN(yearA) || monthA === undefined) return -1
          if (isNaN(yearB) || monthB === undefined) return 1
          
          if (yearA !== yearB) return yearA - yearB
          return monthA - monthB
        } catch (error) {
          return 0
        }
      })

      // Sort category data by amount (descending)
      categoryDataArray.sort((a, b) => b.amount - a.amount)

      // Calculate summary statistics
      const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0)
      const monthlyAverage = monthlyDataArray.length > 0 
        ? totalExpense / monthlyDataArray.length 
        : 0
      const totalTransactions = expenses.length
      const highestCategory = categoryDataArray.length > 0 
        ? categoryDataArray[0].category 
        : 'N/A'
      const highestCategoryAmount = categoryDataArray.length > 0 
        ? categoryDataArray[0].amount 
        : 0

      return {
        monthlyData: monthlyDataArray,
        categoryData: categoryDataArray,
        expenses,
        summary: {
          totalExpense,
          monthlyAverage,
          totalTransactions,
          highestCategory,
          highestCategoryAmount
        }
      }
    },
  })
}
