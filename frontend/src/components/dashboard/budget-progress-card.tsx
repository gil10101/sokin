"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ChartError } from "./chart-error"
import { EmptyState } from "./empty-state"
import { useAuth } from "@/contexts/auth-context"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Budget } from "@/lib/types"
import { useViewport } from "@/hooks/use-mobile"
import { budgetsAPI } from "@/lib/api"
import { useExpensesData } from "@/hooks/use-expenses-data"

// Date calculation helpers to prevent overflow and use exclusive bounds
const addMonthsClamp = (date: Date, months: number): Date => {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  const targetYear = result.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;
  
  // Get the last day of the target month
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const originalDay = result.getDate();
  
  // Clamp day to valid range for target month
  const clampedDay = Math.min(originalDay, lastDayOfTargetMonth);
  
  return new Date(targetYear, normalizedMonth, clampedDay, 
    result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds());
};

const addYearsClamp = (date: Date, years: number): Date => {
  const result = new Date(date);
  const targetYear = result.getFullYear() + years;
  const originalDay = result.getDate();
  const originalMonth = result.getMonth();
  
  // Handle leap year edge case for Feb 29
  if (originalMonth === 1 && originalDay === 29) {
    const isTargetLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    const clampedDay = isTargetLeapYear ? 29 : 28;
    return new Date(targetYear, originalMonth, clampedDay,
      result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds());
  }
  
  return new Date(targetYear, originalMonth, originalDay,
    result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds());
};

interface BudgetProgress {
  category: string
  budget: number
  spent: number
  percentage: number
}

interface BudgetProgressCardProps {
  refreshTrigger?: number
}

export function BudgetProgressCard({ refreshTrigger }: BudgetProgressCardProps) {
  const { user } = useAuth()
  const { isMobile, isTablet } = useViewport()
  const [data, setData] = useState<BudgetProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: expenses = [], isLoading: expensesLoading, isError: expensesError, refetch: refetchExpenses } = useExpensesData()
  const [budgets, setBudgets] = useState<Budget[]>([])

  // Responsive chart configuration
  const chartConfig = useMemo(() => {
    if (isMobile) {
      return {
        margin: { top: 15, right: 30, left: 50, bottom: 5 },
        fontSize: 10,
        yAxisWidth: 60,
      }
    } else if (isTablet) {
      return {
        margin: { top: 20, right: 40, left: 65, bottom: 5 },
        fontSize: 11,
        yAxisWidth: 70,
      }
    } else {
      return {
        margin: { top: 20, right: 50, left: 80, bottom: 5 },
        fontSize: 12,
        yAxisWidth: 80,
      }
    }
  }, [isMobile, isTablet])

  const fetchBudgets = useCallback(async () => {
    if (!user) return
    try {
      const budgetsData: Budget[] = []
      let cursor: string | null = null
      let hasMore = true
      let pageCount = 0

      while (hasMore && pageCount < 50) {
        const page = await budgetsAPI.getBudgets({
          limit: 100,
          cursor: cursor || undefined
        })
        budgetsData.push(...page.items)
        cursor = page.nextCursor || null
        hasMore = page.hasMore
        pageCount += 1
      }

      setBudgets(budgetsData.filter((budget) => budget.amount > 0))
    } catch (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error fetching budget progress', { error: error instanceof Error ? error.message : String(error) })
      })
      setError("Failed to load budget data")
      setBudgets([])
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      setData([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    fetchBudgets().finally(() => setLoading(false))
  }, [user, refreshTrigger, fetchBudgets])

  useEffect(() => {
    if (!user || expensesLoading || budgets.length === 0) {
      return
    }

    const safeParseDate = (dateValue: unknown): Date | null => {
      try {
        if (!dateValue) return null
        if (dateValue instanceof Date) return dateValue
        if (typeof dateValue === 'number') return new Date(dateValue)
        if (typeof dateValue === 'string') {
          const parsed = new Date(dateValue)
          return isNaN(parsed.getTime()) ? null : parsed
        }
        return null
      } catch {
        return null
      }
    }

    const progressData = budgets.map((budget) => {
      const budgetStartDate = safeParseDate(budget.startDate) || new Date()
      let budgetEndDate = budget.endDate ? safeParseDate(budget.endDate) : null

      if (!budgetEndDate) {
        const startDate = new Date(budgetStartDate)
        switch (budget.period) {
          case "monthly":
            budgetEndDate = addMonthsClamp(startDate, 1)
            break
          case "yearly":
            budgetEndDate = addYearsClamp(startDate, 1)
            break
          case "weekly":
            budgetEndDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            break
          case "daily":
            budgetEndDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
            break
          default:
            budgetEndDate = new Date()
            break
        }
      }

      const relevantExpenses = expenses.filter((expense) => {
        const expenseDate = safeParseDate(expense.date)
        if (!expenseDate) return false

        const matchesCategory = expense.category === budget.category
        const isInDateRange = expenseDate >= budgetStartDate &&
          (budgetEndDate ? expenseDate < budgetEndDate : true)

        return matchesCategory && isInDateRange
      })

      const spent = relevantExpenses.reduce((total, expense) => total + expense.amount, 0)
      const percentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0

      return {
        category: budget.category || "Other",
        budget: budget.amount,
        spent,
        percentage: Math.max(0, percentage),
      }
    })

    progressData.sort((a, b) => b.percentage - a.percentage)
    setData(progressData)
  }, [budgets, expenses, expensesLoading, user])

  // Get color based on percentage
  const getColor = (percentage: number) => {
    if (percentage < 70) return "rgba(245, 245, 240, 0.6)"
    if (percentage < 90) return "rgba(245, 245, 240, 0.8)"
    if (percentage < 100) return "rgba(245, 245, 240, 1)"
    return "rgba(255, 99, 71, 0.8)" // Tomato color for over budget
  }

  // A failed load must not fall through to a chart of zeros - an empty
  // result and a failed request are different claims about the user's money.
  if (expensesError) {
    return <ChartError height={300} label="budget progress" onRetry={() => refetchExpenses()} />
  }

  if (loading || expensesLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center text-center px-4">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <p className="text-cream/40 text-sm">Please try again later</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        height={300}
        title="No budget data available"
        description="Create budgets to track your spending progress"
      />
    )
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={chartConfig.margin}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: chartConfig.fontSize }}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: chartConfig.fontSize }}
            width={chartConfig.yAxisWidth}
          />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} background={{ fill: "rgba(245, 245, 240, 0.1)" }}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.percentage)} />
            ))}
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(value: React.ReactNode) => `${value}%`}
              style={{ fill: "rgba(245, 245, 240, 0.8)", fontSize: chartConfig.fontSize }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

