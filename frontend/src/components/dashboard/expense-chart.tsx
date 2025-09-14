"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Area, ComposedChart } from "recharts"
// Removed ChartContainer due to type compatibility issues - using plain div instead
import { LoadingSpinner } from "../../components/ui/loading-spinner"
import { MotionDiv } from "../ui/dynamic-motion"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useAuth } from "../../contexts/auth-context"
import { useViewport } from "../../hooks/use-mobile"
import { format, subDays, subMonths, isAfter } from "date-fns"
import { safeParseDate } from "../../types/firebase"
import { logger } from "../../lib/logger"

interface Expense {
  id: string
  name: string
  amount: number
  date: string
  category: string
  userId: string
}

interface ChartDataPoint {
  name: string
  amount: number
  average: number
}

interface ExpenseChartProps {
  timeframe?: string
}

export function ExpenseChart({ timeframe = "30days" }: ExpenseChartProps) {
  const { user } = useAuth()
  const { isMobile } = useViewport()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const chartRef = useRef<HTMLDivElement>(null)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchExpenseData = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Calculate date range based on timeframe
      const endDate = new Date()
      let startDate: Date

      switch (timeframe) {
        case "30days":
          startDate = subDays(endDate, 30)
          break
        case "90days":
          startDate = subDays(endDate, 90)
          break
        case "year":
          startDate = subMonths(endDate, 12)
          break
        default:
          startDate = subDays(endDate, 30)
      }

      // Fetch expenses from Firebase
      const expensesRef = collection(db, "expenses")
      const q = query(expensesRef, where("userId", "==", user.uid))

      const querySnapshot = await getDocs(q)
      const allExpenses = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[]

      // Filter expenses by date range
      const filteredExpenses = allExpenses.filter((expense) => {
        const expenseDate = safeParseDate(expense.date)
        return isAfter(expenseDate, startDate) || expenseDate.getTime() === startDate.getTime()
      })

      // Group expenses by actual expense dates only
      const expensesByDate = new Map<string, { amount: number, date: Date }>()
      
      filteredExpenses.forEach((expense) => {
        const expenseDate = safeParseDate(expense.date)
        let dateKey: string
        
        if (timeframe === "year") {
          dateKey = format(expenseDate, "MMM yyyy")
        } else {
          dateKey = format(expenseDate, "MMM d")
        }
        
        if (expensesByDate.has(dateKey)) {
          expensesByDate.get(dateKey)!.amount += expense.amount
        } else {
          expensesByDate.set(dateKey, {
            amount: expense.amount,
            date: expenseDate
          })
        }
      })

      // Convert to chart data and sort by date
      const sortedData = Array.from(expensesByDate.entries())
        .map(([name, { amount, date }]) => ({
          name,
          amount,
          sortDate: date
        }))
        .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())

      // Calculate proper moving average for each data point
      const groupedData: ChartDataPoint[] = sortedData.map((item, index) => {
        // Calculate moving average based on all previous data points including current
        const relevantAmounts = sortedData.slice(0, index + 1).map(d => d.amount)
        const movingAverage = relevantAmounts.reduce((sum, amt) => sum + amt, 0) / relevantAmounts.length
        
        return {
          name: item.name,
          amount: item.amount,
          average: movingAverage
        }
      })

      setChartData(groupedData)
      setHasData(groupedData.length > 0)
    } catch (error) {
      logger.error("Error fetching expense data", {
        userId: user?.uid,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setChartData([])
    } finally {
      setLoading(false)
    }
  }

  // Load expense data on component mount and when dependencies change
  useEffect(() => {
    if (mounted) {
      fetchExpenseData()
    }
  }, [user, timeframe, mounted])

  // ResponsiveContainer automatically handles window resize events
  // No manual resize handling needed

  if (!mounted || loading) {
    return (
      <div className={`${isMobile ? 'h-[280px]' : 'h-[400px]'} flex items-center justify-center`}>
        <MotionDiv
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingSpinner size="md" />
        </MotionDiv>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className={`${isMobile ? 'h-[280px]' : 'h-[400px]'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-cream/60 mb-2">No expense data available</div>
          <div className="text-sm text-cream/40">Add some expenses to see spending trends</div>
        </div>
      </div>
    )
  }

  return (
    <MotionDiv
      ref={chartRef}
      className={`${isMobile ? 'h-[280px]' : 'h-[400px]'} w-full min-w-0 overflow-hidden`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className={`${isMobile ? 'h-[280px]' : 'h-[400px]'} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={isMobile ? { top: 5, right: 0, left: -15, bottom: 15 } : { top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(245, 245, 240, 0.8)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgba(245, 245, 240, 0.2)" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(200, 200, 190, 0.6)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="rgba(200, 200, 190, 0.1)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 9 : 12 }}
              dy={10}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 50 : 30}
              interval={isMobile ? 1 : 0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 9 : 12 }}
              tickFormatter={(value) => isMobile ? `$${(value/1000).toFixed(0)}k` : `$${value}`}
              width={isMobile ? 30 : 60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-dark border border-cream/10 p-2 rounded-md shadow-md">
                      <p className="text-cream font-medium">{payload[0].payload.name}</p>
                      <div className="flex items-center mt-1">
                        <div className="h-2 w-2 rounded-full bg-cream/80 mr-1"></div>
                        <p className="text-cream text-sm">Amount: ${Number(payload[0].value).toFixed(2)}</p>
                      </div>
                      {payload[1] && (
                        <div className="flex items-center mt-1">
                          <div className="h-2 w-2 rounded-full bg-cream/50 mr-1"></div>
                          <p className="text-cream/80 text-sm">Moving Average: ${Number(payload[1].value).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="average"
              stroke="rgba(200, 200, 190, 0.6)"
              strokeWidth={1}
              fillOpacity={0.2}
              fill="url(#colorAverage)"
              animationDuration={1500}
              animationEasing="ease-out"
              isAnimationActive={!loading}
            />
            <Bar
              dataKey="amount"
              fill="url(#colorAmount)"
              radius={[4, 4, 0, 0]}
              barSize={isMobile ? (timeframe === "year" ? 12 : 16) : (timeframe === "year" ? 20 : 30)}
              animationDuration={1500}
              animationEasing="ease-out"
              isAnimationActive={!loading}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </MotionDiv>
  )
}