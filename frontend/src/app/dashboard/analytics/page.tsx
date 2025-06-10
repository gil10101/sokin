"use client"

import { useState, useEffect } from "react"
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore"
import { auth, db } from "../../../lib/firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { format, subMonths, parse } from "date-fns"
import { motion } from "framer-motion"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { MonthlyTrendsChart } from "../../../components/dashboard/monthly-trends-chart"
import { CategoryComparisonChart } from "../../../components/dashboard/category-comparison-chart"
import { SpendingHeatmap } from "../../../components/dashboard/spending-heatmap"
import { BudgetProgressChart } from "../../../components/dashboard/budget-progress-chart"
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { useToast } from "../../../hooks/use-toast"
import { LoadingSpinner } from "../../../components/ui/loading-spinner"

// Helper function to safely parse dates
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

export default function AnalyticsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [user] = useAuthState(auth)
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [categoryData, setCategoryData] = useState<any[]>([])
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
            startDate = subMonths(endDate, 3)
            break
          case "12months":
            startDate = subMonths(endDate, 12)
            break
          case "6months":
          default:
            startDate = subMonths(endDate, 6)
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
        const expenses = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        console.log("Fetched expenses:", expenses.length)

        // Process data for monthly trends
        const monthlyTrends: any = {}
        const categoryTotals: any = {}

        expenses.forEach((expense: any) => {
          const date = safeParseDate(expense.date)
          const monthYear = format(date, "MMM yyyy")

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
            const dateA = parse(a.month, "MMM yyyy", new Date())
            const dateB = parse(b.month, "MMM yyyy", new Date())
            return dateA.getTime() - dateB.getTime()
          } catch (error) {
            console.error("Error sorting monthly data:", error)
            return 0
          }
        })

        // Sort category data by amount (descending)
        categoryDataArray.sort((a, b) => (b.amount as number) - (a.amount as number))

        console.log("Processed monthly data:", monthlyDataArray)
        console.log("Processed category data:", categoryDataArray)

        setMonthlyData(monthlyDataArray)
        setCategoryData(categoryDataArray)
      } catch (error: any) {
        console.error("Analytics fetch error:", error)
        toast({
          title: "Error loading analytics",
          description: error.message || "There was an error loading your analytics data",
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
          <motion.header
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
              <Tabs defaultValue="6months" value={timeframe} onValueChange={setTimeframe} className="w-full">
                <TabsList className="bg-cream/5 text-cream">
                  <TabsTrigger
                    value="3months"
                    className="data-[state=active]:bg-cream/10 transition-all duration-200 hover:bg-cream/8"
                  >
                    3 Months
                  </TabsTrigger>
                  <TabsTrigger
                    value="6months"
                    className="data-[state=active]:bg-cream/10 transition-all duration-200 hover:bg-cream/8"
                  >
                    6 Months
                  </TabsTrigger>
                  <TabsTrigger
                    value="12months"
                    className="data-[state=active]:bg-cream/10 transition-all duration-200 hover:bg-cream/8"
                  >
                    12 Months
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </motion.header>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <motion.div 
                  key={i} 
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 h-[400px] flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <LoadingSpinner variant="pulse" size="md" />
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <motion.div
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Monthly Spending Trends</h2>
                  </div>
                  <MonthlyTrendsChart data={monthlyData} />
                </motion.div>

                <motion.div
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Spending by Category</h2>
                  </div>
                  <CategoryComparisonChart data={categoryData} />
                </motion.div>

                <motion.div
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Spending Heatmap</h2>
                  </div>
                  <SpendingHeatmap />
                </motion.div>

                <motion.div
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Budget Progress</h2>
                  </div>
                  <BudgetProgressChart />
                </motion.div>
              </div>

              <motion.div
                variants={item}
                className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8 hover:border-cream/20 transition-colors duration-300"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Spending Insights</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div
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
                  </motion.div>
                  <motion.div
                    className="bg-cream/10 rounded-lg p-4 hover:bg-cream/15 transition-colors duration-300"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2">Top Spending Category</h3>
                    <p className="text-2xl font-medium">{categoryData.length > 0 ? categoryData[0].category : "N/A"}</p>
                    <p className="text-cream/60 text-sm">
                      ${categoryData.length > 0 ? categoryData[0].amount.toFixed(2) : "0.00"}
                    </p>
                  </motion.div>
                  <motion.div
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
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  )
}

