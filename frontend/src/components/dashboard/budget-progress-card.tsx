"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useAuth } from "../../contexts/auth-context"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts"
import { LoadingSpinner } from "../../components/ui/loading-spinner"
import { Expense, Budget } from "../../lib/types"
import { useViewport } from "../../hooks/use-mobile"

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

  useEffect(() => {
    const fetchBudgetProgress = async () => {
      if (!user) {
        setLoading(false);
        setData([]);
        setError(null);
        return;
      }

      setLoading(true)
      setError(null)
      try {
        // Fetch active budgets (all periods, not just monthly)
        const budgetsRef = collection(db, "budgets")
        const budgetsQuery = query(
          budgetsRef,
          where("userId", "==", user.uid),
          // Remove period filter to show all budgets
        )
        const budgetsSnapshot = await getDocs(budgetsQuery)

        if (budgetsSnapshot.empty) {
          setData([])
          setLoading(false)
          return
        }

        // Parse budget data with robust error handling
        const budgets = budgetsSnapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            userId: data.userId || "",
            category: data.category || "Unknown",
            amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
            period: data.period || "monthly",
            startDate: data.startDate || new Date().toISOString(),
            endDate: data.endDate || null,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            notes: data.notes || null,
          }
        }).filter(budget => budget.amount > 0) // Filter out invalid budgets

        // Fetch all expenses for budget calculations
        const expensesRef = collection(db, "expenses")
        const expensesQuery = query(
          expensesRef,
          where("userId", "==", user.uid),
        )
        const expensesSnapshot = await getDocs(expensesQuery)

        // Parse expense data with robust error handling
        const expenses = expensesSnapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            userId: data.userId || "",
            name: data.name || data.description || "Unknown",
            amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0,
            date: data.date || new Date().toISOString(),
            category: data.category || "Other",
            description: data.description || "",
            tags: Array.isArray(data.tags) ? data.tags : [],
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          }
        }).filter(expense => expense.amount > 0) // Filter out invalid expenses

        // Helper function to safely parse dates
        const safeParseDate = (dateValue: unknown): Date | null => {
          try {
            if (!dateValue) return null
            if (dateValue instanceof Date) return dateValue
            if (typeof dateValue === 'object' && 'toDate' in dateValue) {
              return (dateValue as any).toDate()
            }
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

        // Create budget progress data with better date handling
        const progressData = budgets.map((budget) => {
          const budgetStartDate = safeParseDate(budget.startDate) || new Date()
          let budgetEndDate = budget.endDate ? safeParseDate(budget.endDate) : null

          // Calculate effective end date based on period (exclusive)
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
                // For custom periods, use current date if no end date
                budgetEndDate = new Date()
                break
            }
          }

          // Filter expenses for this budget's category and date range
          const relevantExpenses = expenses.filter((expense) => {
            const expenseDate = safeParseDate(expense.date)
            if (!expenseDate) return false

            const matchesCategory = expense.category === budget.category
            const isInDateRange = expenseDate >= budgetStartDate && 
                                  (budgetEndDate ? expenseDate < budgetEndDate : true)

            return matchesCategory && isInDateRange
          })

          // Calculate total spent
          const spent = relevantExpenses.reduce((total, expense) => total + expense.amount, 0)
          const percentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0

          return {
            category: budget.category,
            budget: budget.amount,
            spent,
            percentage: Math.max(0, percentage), // Ensure non-negative percentage
          }
        })

        // Sort by percentage descending to show highest usage first
        progressData.sort((a, b) => b.percentage - a.percentage)

        setData(progressData)
      } catch (error) {
        // Log error to Sentry instead of console
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Error fetching budget progress', { error: error instanceof Error ? error.message : String(error) })
        })
        setError("Failed to load budget data")
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchBudgetProgress()
  }, [user, refreshTrigger])

  // Get color based on percentage
  const getColor = (percentage: number) => {
    if (percentage < 70) return "rgba(245, 245, 240, 0.6)"
    if (percentage < 90) return "rgba(245, 245, 240, 0.8)"
    if (percentage < 100) return "rgba(245, 245, 240, 1)"
    return "rgba(255, 99, 71, 0.8)" // Tomato color for over budget
  }

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <p className="text-cream/40 text-sm">Please try again later</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center">
        <p className="text-cream/60 text-lg mb-4">No budget data available</p>
        <p className="text-cream/40 text-sm">Create budgets to track your spending progress</p>
      </div>
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

