"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts"
import { motion } from "framer-motion"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useAuth } from "../../contexts/auth-context"
import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns"

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: any): Date => {
  if (!dateValue) return new Date()
  
  try {
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue
    }
    // If it's a Firebase Timestamp object
    else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
      return dateValue.toDate()
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
    console.error("Error parsing date:", error, "Input:", dateValue)
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
  const [data, setData] = useState<BudgetProgressData[]>([])
  const [animatedData, setAnimatedData] = useState<BudgetProgressData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchBudgetData()
    }
  }, [user])

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
    try {
      // Fetch budgets
      const budgetsRef = collection(db, "budgets")
      const budgetsQuery = query(budgetsRef, where("userId", "==", user.uid))
      const budgetsSnapshot = await getDocs(budgetsQuery)
      
      const budgets = budgetsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Budget[]

      // Fetch expenses
      const expensesRef = collection(db, "expenses")
      const expensesQuery = query(expensesRef, where("userId", "==", user.uid))
      const expensesSnapshot = await getDocs(expensesQuery)
      
      const expenses = expensesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[]

      // Process data to create budget progress
      const currentMonth = new Date()
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)

      const budgetProgress: BudgetProgressData[] = []

      // Group budgets by category or use budget name
      budgets.forEach((budget) => {
        // Filter expenses for this budget's timeframe and categories
        const relevantExpenses = expenses.filter((expense) => {
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

      // If no budgets exist, create sample data from expense categories
      if (budgetProgress.length === 0) {
        const categorySpending: Record<string, number> = {}
        
        expenses.forEach((expense) => {
          const expenseDate = safeParseDate(expense.date)
          if (isWithinInterval(expenseDate, { start: monthStart, end: monthEnd })) {
            categorySpending[expense.category] = (categorySpending[expense.category] || 0) + expense.amount
          }
        })

        // Create mock budgets based on spending (150% of actual spending for demonstration)
        Object.entries(categorySpending).slice(0, 5).forEach(([category, spent]) => {
          const mockBudget = spent * 1.5
          budgetProgress.push({
            category,
            budget: mockBudget,
            spent,
            percentage: Math.round((spent / mockBudget) * 100),
          })
        })
      }

      setData(budgetProgress.slice(0, 5)) // Show top 5
    } catch (error) {
      console.error("Error fetching budget data:", error)
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
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-cream/60">Loading budget data...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-cream/60 mb-2">No budget data available</div>
          <div className="text-sm text-cream/40">Create some budgets to see progress here</div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="h-[300px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={animatedData} layout="vertical" margin={{ top: 20, right: 50, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
            domain={[0, 120]}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
            width={80}
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
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(value: number) => `${value}%`}
              style={{ fill: "rgba(245, 245, 240, 0.8)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

