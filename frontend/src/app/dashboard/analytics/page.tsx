"use client"

import React, { useState, useEffect } from "react"
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore"
import { auth, db } from "../../../lib/firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { formatDate, dateCalc, safeParseDate } from "../../../lib/date-utils"
import { MotionDiv, MotionMain, MotionHeader } from "../../../components/ui/dynamic-motion"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
// Lazy load heavy chart components for better performance
import { 
  LazyMonthlyTrendsChart, 
  LazyCategoryComparisonChart, 
  LazySpendingHeatmap,
  LazyWrapper 
} from "../../../components/ui/lazy-components"
import { IntersectionLazy } from "../../../components/ui/intersection-lazy"
import { ChartErrorBoundary } from "../../../components/ui/error-boundary"
import { BudgetProgressCard } from "../../../components/dashboard/budget-progress-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"

// Properly typed Select components
const TypedSelectTrigger = SelectTrigger
const TypedSelectContent = SelectContent
const TypedSelectItem = SelectItem
import { useToast } from "../../../hooks/use-toast"
import { LoadingSpinner } from "../../../components/ui/loading-spinner"
import { Expense } from "../../../lib/types"

// Types for analytics data
interface MonthlyTrendData {
  total: number
  count: number
  average: number
}

interface CategoryTotalData {
  total: number
  count: number
  percentage: number
}




export default function AnalyticsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [user] = useAuthState(auth)
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<{ month: string; amount: number }[]>([])
  const [categoryData, setCategoryData] = useState<{ category: string; amount: number }[]>([])
  const [timeframe, setTimeframe] = useState("6months")

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!user) return

      setLoading(true)
      try {
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

        // Convert to Firestore Timestamp objects for proper comparison
        const startTimestamp = Timestamp.fromDate(startDate)
        const endTimestamp = Timestamp.fromDate(endDate)

        // Query expenses within date range
        const expensesRef = collection(db, "expenses")
        const q = query(
          expensesRef,
          where("userId", "==", user.uid),
          where("date", ">=", startTimestamp),
          where("date", "<=", endTimestamp),
        )

        const querySnapshot = await getDocs(q)
        const expenses: Expense[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Expense[]



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

        // Sort monthly data chronologically by parsing the month string back to date
        monthlyDataArray.sort((a, b) => {
          try {
            // Parse format like "Jan 2024" back to Date for comparison
            const [monthStr, yearStr] = a.month.split(' ')
            const [monthStrB, yearStrB] = b.month.split(' ')
            const monthA = new Date(`${monthStr} 1, ${yearStr}`).getMonth()
            const monthB = new Date(`${monthStrB} 1, ${yearStrB}`).getMonth()
            const yearA = parseInt(yearStr)
            const yearB = parseInt(yearStrB)
            
            if (yearA !== yearB) return yearA - yearB
            return monthA - monthB
          } catch (error) {
            return 0
          }
        })

        // Sort category data by amount (descending)
        categoryDataArray.sort((a, b) => b.amount - a.amount)



        setMonthlyData(monthlyDataArray)
        setCategoryData(categoryDataArray)
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "There was an error loading your analytics data"

        toast({
          title: "Error loading analytics",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [user, timeframe, toast])

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <MotionHeader
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-medium font-outfit">Analytics</h1>
              <p className="text-cream/60 text-sm mt-1 font-outfit">Detailed insights into your spending patterns</p>
            </div>
            <div>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <TypedSelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20 w-full md:w-48">
                  <SelectValue placeholder="Select timeframe" />
                </TypedSelectTrigger>
                <TypedSelectContent className="bg-dark border-cream/10">
                  <TypedSelectItem value="3months" className="text-cream hover:bg-cream/10">
                    3 Months
                  </TypedSelectItem>
                  <TypedSelectItem value="6months" className="text-cream hover:bg-cream/10">
                    6 Months
                  </TypedSelectItem>
                  <TypedSelectItem value="12months" className="text-cream hover:bg-cream/10">
                    12 Months
                  </TypedSelectItem>
                </TypedSelectContent>
              </Select>
            </div>
          </MotionHeader>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <MotionDiv 
                  key={i} 
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 h-[400px] flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <LoadingSpinner variant="pulse" size="md" />
                </MotionDiv>
              ))}
            </div>
          ) : (
            <MotionDiv variants={container} initial="hidden" animate="show" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Monthly Spending Trends</h2>
                  </div>
                  <ChartErrorBoundary>
                    <LazyWrapper>
                      <IntersectionLazy>
                        <LazyMonthlyTrendsChart data={monthlyData} />
                      </IntersectionLazy>
                    </LazyWrapper>
                  </ChartErrorBoundary>
                </MotionDiv>

                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Spending by Category</h2>
                  </div>
                  <ChartErrorBoundary>
                    <LazyWrapper>
                      <IntersectionLazy>
                        <LazyCategoryComparisonChart data={categoryData} />
                      </IntersectionLazy>
                    </LazyWrapper>
                  </ChartErrorBoundary>
                </MotionDiv>

                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Spending Heatmap</h2>
                  </div>
                  <ChartErrorBoundary>
                    <LazyWrapper>
                      <IntersectionLazy>
                        <LazySpendingHeatmap />
                      </IntersectionLazy>
                    </LazyWrapper>
                  </ChartErrorBoundary>
                </MotionDiv>

                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Budget Progress</h2>
                  </div>
                  <BudgetProgressCard />
                </MotionDiv>
              </div>

              <MotionDiv
                variants={item}
                className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8 hover:border-cream/20 transition-colors duration-300"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Spending Insights</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MotionDiv
                    className="bg-cream/10 rounded-lg p-4 hover:bg-cream/15 transition-colors duration-300"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2">Highest Spending Month</h3>
                    <p className="text-2xl font-medium">
                      {monthlyData.length > 0
                        ? monthlyData.reduce((prev, current) => (current.amount > prev.amount ? current : prev)).month
                        : "N/A"}
                    </p>
                    <p className="text-cream/60 text-sm">
                      $
                      {monthlyData.length > 0
                        ? monthlyData
                            .reduce((prev, current) => (current.amount > prev.amount ? current : prev))
                            .amount.toFixed(2)
                        : "0.00"}
                    </p>
                  </MotionDiv>
                  <MotionDiv
                    className="bg-cream/10 rounded-lg p-4 hover:bg-cream/15 transition-colors duration-300"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2">Top Spending Category</h3>
                    <p className="text-2xl font-medium">{categoryData.length > 0 ? categoryData[0].category : "N/A"}</p>
                    <p className="text-cream/60 text-sm">
                      ${categoryData.length > 0 ? categoryData[0].amount.toFixed(2) : "0.00"}
                    </p>
                  </MotionDiv>
                  <MotionDiv
                    className="bg-cream/10 rounded-lg p-4 hover:bg-cream/15 transition-colors duration-300"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2">Average Monthly Spend</h3>
                    <p className="text-2xl font-medium">
                      $
                      {monthlyData.length > 0
                        ? (monthlyData.reduce((sum, item) => sum + item.amount, 0) / monthlyData.length).toFixed(2)
                        : "0.00"}
                    </p>
                    <p className="text-cream/60 text-sm">Over {monthlyData.length} months</p>
                  </MotionDiv>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </div>
      </main>
    </div>
  )
}

