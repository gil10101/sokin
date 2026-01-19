"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts"
import { MotionDiv } from "../ui/dynamic-motion"
import { useAuth } from "@/contexts/auth-context"
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { useViewport } from "@/hooks/use-mobile"
import { budgetsAPI } from "@/lib/api"
import { useExpensesData } from "@/hooks/use-expenses-data"

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: unknown): Date => {
  if (!dateValue) return new Date()
  
  // Handle Firebase Timestamp
  if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
    return (dateValue as { toDate: () => Date }).toDate()
  }
  
  // Handle ISO string or Date object
  const date = new Date(dateValue as string | Date)
  return isNaN(date.getTime()) ? new Date() : date
}

interface Budget {
  id: string
  userId: string
  category?: string
  categories?: string[]
  amount: number
  spent?: number
  startDate: string
  endDate?: string
  period: "daily" | "weekly" | "monthly" | "yearly"
}


interface BudgetProgressData {
  category: string
  budgeted: number
  spent: number
  remaining: number
  percentage: number
}

interface BudgetProgressChartProps {
  selectedMonth?: Date
}

export function BudgetProgressChart({ selectedMonth }: BudgetProgressChartProps) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<BudgetProgressData[]>([])
  const { user } = useAuth()
  const { isMobile, isTablet } = useViewport()
  const { data: expenses = [], isLoading: expensesLoading } = useExpensesData()

  // Responsive chart configuration
  const chartConfig = useMemo(() => {
    if (isMobile) {
      return {
        height: 320,
        margin: { top: 20, right: 10, left: 0, bottom: 70 },
        fontSize: 10,
        barSize: 20,
        angle: -45,
      }
    } else if (isTablet) {
      return {
        height: 350,
        margin: { top: 20, right: 15, left: 0, bottom: 65 },
        fontSize: 11,
        barSize: 25,
        angle: -30,
      }
    } else {
      return {
        height: 400,
        margin: { top: 20, right: 20, left: 10, bottom: 80 },
        fontSize: 12,
        barSize: 30,
        angle: -20,
      }
    }
  }, [isMobile, isTablet])

  // Use current month if selectedMonth is not provided
  const currentMonth = useMemo(() => selectedMonth || new Date(), [selectedMonth])
  
  const fetchBudgets = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

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

      setBudgets(budgetsData)
    } catch (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error fetching budget data', { error: error instanceof Error ? error.message : String(error) })
      })
      setBudgets([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setBudgets([])
      setLoading(false)
      return
    }
    fetchBudgets()
  }, [fetchBudgets, user])

  // Process chart data
  useEffect(() => {
    if (!budgets.length || expensesLoading) {
      setChartData([])
      return
    }

    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)

    const activeBudgets = budgets.filter((budget) => {
      const startDate = safeParseDate(budget.startDate)
      const endDate = budget.endDate ? safeParseDate(budget.endDate) : null
      const withinStart = startDate <= monthEnd
      const withinEnd = endDate ? endDate >= monthStart : true
      return withinStart && withinEnd
    })

    const spentByCategory: { [key: string]: number } = {}

    expenses.forEach((expense) => {
      const expenseDate = safeParseDate(expense.date)
      if (!isWithinInterval(expenseDate, { start: monthStart, end: monthEnd })) {
        return
      }
      const category = expense.category
      spentByCategory[category] = (spentByCategory[category] || 0) + expense.amount
    })

    const processedData: BudgetProgressData[] = activeBudgets.map((budget) => {
      const category = budget.category || budget.categories?.[0] || "Other"
      const spent = spentByCategory[category] || 0
      const remaining = Math.max(0, budget.amount - spent)
      const percentage = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0

      return {
        category,
        budgeted: budget.amount,
        spent,
        remaining,
        percentage
      }
    })

    processedData.sort((a, b) => b.percentage - a.percentage)

    setChartData(processedData)
  }, [budgets, expenses, currentMonth, expensesLoading])

  const getBarColor = (percentage: number): string => {
    if (percentage >= 90) return '#ef4444' // Red - over budget or close to it
    if (percentage >= 70) return '#f59e0b' // Amber - getting close
    if (percentage >= 50) return '#10b981' // Green - good progress
    return 'rgba(245, 245, 240, 0.8)' // Light - minimal spending
  }

  const CustomizedLabel = (props: any) => {
    const { x, y, width, value } = props
    const radius = 10
    
    return (
      <g>
        <text
          x={x + width / 2}
          y={y - radius}
          fill="rgba(245, 245, 240, 0.9)"
          textAnchor="middle"
          fontSize={isMobile ? "9" : "10"}
          dominantBaseline="middle"
        >
          {`${Math.round(value)}%`}
        </text>
      </g>
    )
  }

  if (loading || expensesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cream/30"></div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-cream/50">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">No budget data available</p>
          <p className="text-xs opacity-75 mt-1">Set up budgets to track your progress</p>
        </div>
      </div>
    )
  }

  return (
    <MotionDiv
      className="w-full"
      style={{ height: chartConfig.height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={chartConfig.margin}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 245, 240, 0.1)" />
          
          <XAxis
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "rgba(245, 245, 240, 0.6)",
              fontSize: chartConfig.fontSize,
              textAnchor: "end"
            }}
            angle={chartConfig.angle}
            textAnchor="end"
            height={isMobile ? 90 : isTablet ? 85 : 80}
            interval={0}
          />
          
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "rgba(245, 245, 240, 0.6)",
              fontSize: chartConfig.fontSize
            }}
            tickFormatter={(value) => `${Math.round(value)}%`}
            domain={[0, 100]}
          />
          
          <Bar
            dataKey="percentage"
            radius={[4, 4, 0, 0]}
            maxBarSize={chartConfig.barSize}
          >
            <LabelList content={<CustomizedLabel />} />
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </MotionDiv>
  )
}