"use client"

import { useState, useEffect } from "react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useAuth } from "../../contexts/auth-context"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts"
import { LoadingSpinner } from "../../components/ui/loading-spinner"
import { Expense, Budget } from "../../lib/types"

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
  const [data, setData] = useState<BudgetProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBudgetProgress = async () => {
      if (!user) return

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

          // Calculate effective end date based on period
          if (!budgetEndDate) {
            const startDate = new Date(budgetStartDate)
            switch (budget.period) {
              case "monthly":
                budgetEndDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate())
                break
              case "yearly":
                budgetEndDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate())
                break
              case "weekly":
                budgetEndDate = new Date(startDate)
                budgetEndDate.setDate(startDate.getDate() + 7)
                break
              case "daily":
                budgetEndDate = new Date(startDate)
                budgetEndDate.setDate(startDate.getDate() + 1)
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
                                  (budgetEndDate ? expenseDate <= budgetEndDate : true)

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
        console.error("Error fetching budget progress:", error)
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
        <BarChart data={data} layout="vertical" margin={{ top: 20, right: 50, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
            domain={[0, 100]}
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
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} background={{ fill: "rgba(245, 245, 240, 0.1)" }}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.percentage)} />
            ))}
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(value: React.ReactNode) => `${value}%`}
              style={{ fill: "rgba(245, 245, 240, 0.8)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

