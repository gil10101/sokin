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

export function BudgetProgressCard() {
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
        // Fetch active budgets
        const budgetsRef = collection(db, "budgets")
        const budgetsQuery = query(
          budgetsRef,
          where("userId", "==", user.uid),
          where("period", "==", "monthly"), // For simplicity, only showing monthly budgets
        )
        const budgetsSnapshot = await getDocs(budgetsQuery)

        if (budgetsSnapshot.empty) {
          setData([])
          setLoading(false)
          return
        }

        const budgets = budgetsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Budget[]

        // Fetch expenses for the current month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

        const expensesRef = collection(db, "expenses")
        const expensesQuery = query(
          expensesRef,
          where("userId", "==", user.uid),
          where("date", ">=", startOfMonth),
          where("date", "<=", endOfMonth),
        )
        const expensesSnapshot = await getDocs(expensesQuery)

        const expenses = expensesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Expense[]

        // Calculate spending by category
        const spendingByCategory: Record<string, number> = {}
        expenses.forEach((expense: Expense) => {
          const { category, amount } = expense
          spendingByCategory[category] = (spendingByCategory[category] || 0) + amount
        })

        // Create budget progress data
        const progressData = budgets.map((budget: Budget) => {
          const spent = spendingByCategory[budget.category] || 0
          const percentage = Math.round((spent / budget.amount) * 100)

          return {
            category: budget.category,
            budget: budget.amount,
            spent,
            percentage,
          }
        })

        setData(progressData)
      } catch (error) {

        setError("Failed to load budget data")
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchBudgetProgress()
  }, [user])

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
              formatter={(value: number) => `${value}%`}
              style={{ fill: "rgba(245, 245, 240, 0.8)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

