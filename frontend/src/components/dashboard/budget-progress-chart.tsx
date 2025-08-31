"use client"

import { useEffect, useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts"
import { motion } from "framer-motion"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useExpensesData } from "../../hooks/use-expenses-data"
import { useAuth } from "../../contexts/auth-context"
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { useViewport } from "../../hooks/use-mobile"

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: unknown): Date => {
  if (!dateValue) return new Date()
  
  try {
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue
    }
    // If it's a Firebase Timestamp object
    else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue && typeof dateValue.toDate === 'function') {
      return (dateValue as { toDate(): Date }).toDate()
    }
    // If it's a numeric timestamp (milliseconds)
    else if (typeof dateValue === 'number') {
      return new Date(dateValue)
    }
    // If it's a string
    else if (typeof dateValue === 'string') {
      const parsedDate = new Date(dateValue)
      return isNaN(parsedDate.getTime()) ? new Date() : parsedDate
    }
    
    return new Date()
  } catch (error) {
    return new Date()
  }
}

interface Budget {
  id: string
  name?: string
  amount: number
  period: string
  categories: string[]
  startDate: string
  endDate?: string
  userId: string
}

interface Expense {
  id: string
  amount: number
  date: string
  category: string
  userId: string
}

interface BudgetProgressData {
  category: string
  budget: number
  spent: number
  percentage: number
}

export function BudgetProgressChart() {
  const { user } = useAuth()
  const { isMobile, isTablet } = useViewport()
  const [data, setData] = useState<BudgetProgressData[]>([])
  const [animatedData, setAnimatedData] = useState<BudgetProgressData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { data: expenses = [], isLoading: expensesLoading } = useExpensesData()

  // Responsive chart configuration
  const chartConfig = useMemo(() => {
    if (isMobile) {
      return {
        height: 250,
        margin: { top: 20, right: 30, left: 60, bottom: 5 },
        tickFontSize: 10,
        yAxisWidth: 60,
        showLabels: false,
      }
    } else if (isTablet) {
      return {
        height: 280,
        margin: { top: 20, right: 40, left: 70, bottom: 5 },
        tickFontSize: 11,
        yAxisWidth: 70,
        showLabels: true,
      }
    } else {
      return {
        height: 300,
        margin: { top: 20, right: 50, left: 80, bottom: 5 },
        tickFontSize: 12,
        yAxisWidth: 80,
        showLabels: true,
      }
    }
  }, [isMobile, isTablet])

  useEffect(() => {
    if (user && !expensesLoading) {
      fetchBudgetData()
    }
  }, [user, expensesLoading, expenses])

  useEffect(() => {
    if (data.length > 0) {
      // Start with zero percentages for animation
      const initialData = data.map((item) => ({
        ...item,
        percentage: 0,
      }))

      setAnimatedData(initialData)

      // Animate to actual values
      const timer = setTimeout(() => {
        setAnimatedData(data)
      }, 400)

      return () => clearTimeout(timer)
    }
  }, [data])

  const fetchBudgetData = async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    try {
      // Fetch budgets
      const budgetsRef = collection(db, "budgets")
      const budgetsQuery = query(budgetsRef, where("userId", "==", user.uid))
      const budgetsSnapshot = await getDocs(budgetsQuery)
      
      const budgets = budgetsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Budget[]

      // Use shared expenses data
      const sharedExpenses = expenses as Expense[]

      // Process data to create budget progress
      const currentMonth = new Date()
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)

      const budgetProgress: BudgetProgressData[] = []

      // Group budgets by category or use budget name
      budgets.forEach((budget) => {
        // Filter expenses for this budget's timeframe and categories
        const relevantExpenses = sharedExpenses.filter((expense) => {
          const expenseDate = safeParseDate(expense.date)
          const isInTimeRange = isWithinInterval(expenseDate, { start: monthStart, end: monthEnd })
          
          // If budget has specific categories, filter by those
          if (budget.categories && budget.categories.length > 0) {
            return isInTimeRange && budget.categories.includes(expense.category)
          }
          
          // Otherwise, we'll use the budget name as a category match
          return isInTimeRange && expense.category.toLowerCase().includes(budget.name?.toLowerCase() || '')
        })

        const totalSpent = relevantExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        const percentage = budget.amount > 0 ? Math.round((totalSpent / budget.amount) * 100) : 0

        const categoryName = budget.categories && budget.categories.length > 0 
          ? budget.categories[0] 
          : budget.name || 'Unknown'

        budgetProgress.push({
          category: categoryName,
          budget: budget.amount,
          spent: totalSpent,
          percentage,
        })
      })

      setData(budgetProgress.slice(0, 5)) // Show top 5
    } catch (error) {

      setError("Failed to load budget data")
      setData([])
    } finally {
      setLoading(false)
    }
  }

  // Get color based on percentage
  const getColor = (percentage: number) => {
    if (percentage < 70) return "rgba(245, 245, 240, 0.6)"
    if (percentage < 90) return "rgba(245, 245, 240, 0.8)"
    if (percentage < 100) return "rgba(245, 245, 240, 1)"
    return "rgba(255, 99, 71, 0.8)" // Tomato color for over budget
  }

  if (loading) {
    return (
      <div style={{ height: chartConfig.height }} className="flex items-center justify-center">
        <div className="text-cream/60">Loading budget data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ height: chartConfig.height }} className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-2">{error}</div>
          <div className="text-sm text-cream/40">Please try again later</div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ height: chartConfig.height }} className="flex items-center justify-center">
        <div className="text-center">
          <div className="text-cream/60 mb-2">No budget data available</div>
          <div className="text-sm text-cream/40">Create some budgets to see progress here</div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="w-full"
      style={{ height: chartConfig.height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={animatedData} 
          layout="vertical" 
          margin={chartConfig.margin}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: chartConfig.tickFontSize }}
            domain={[0, 120]}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: chartConfig.tickFontSize }}
            width={chartConfig.yAxisWidth}
            tickFormatter={(value) => isMobile && value.length > 8 ? `${value.substring(0, 8)}...` : value}
          />
          <Bar
            dataKey="percentage"
            radius={[0, 4, 4, 0]}
            background={{ fill: "rgba(245, 245, 240, 0.1)" }}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {animatedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.percentage)} />
            ))}
            {chartConfig.showLabels && (
              <LabelList
                dataKey="percentage"
                position="right"
                formatter={(value: number) => `${value}%`}
                style={{ fill: "rgba(245, 245, 240, 0.7)", fontSize: 11 }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

