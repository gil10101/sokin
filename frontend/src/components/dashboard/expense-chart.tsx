"use client"

import { useEffect, useState, useRef } from "react"
import { ChartError } from "./chart-error"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Area, ComposedChart } from "recharts"
// Removed ChartContainer due to type compatibility issues - using plain div instead
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MotionDiv } from "../ui/dynamic-motion"
import { useAuth } from "@/contexts/auth-context"
import { useViewport } from "@/hooks/use-mobile"
import { format, subDays, subMonths, isAfter } from "date-fns"
import { safeParseDate } from "@/types/firebase"
import { logger } from "@/lib/logger"
import { useExpensesData } from "@/hooks/use-expenses-data"
import { useCurrency } from "@/hooks/use-currency"
import { EmptyState } from "./empty-state"

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
  const { format: formatCurrency, formatCompact } = useCurrency()
  const { user } = useAuth()
  const { isMobile } = useViewport()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const chartRef = useRef<HTMLDivElement>(null)
  const { data: expenses = [], isLoading: expensesLoading, isError: expensesError, refetch: refetchExpenses } = useExpensesData()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load expense data on component mount and when dependencies change
  useEffect(() => {
    if (!mounted || expensesLoading || !user) {
      setLoading(expensesLoading)
      return
    }

    try {
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

      const filteredExpenses = (expenses as Expense[]).filter((expense) => {
        const expenseDate = safeParseDate(expense.date)
        return isAfter(expenseDate, startDate) || expenseDate.getTime() === startDate.getTime()
      })

      const expensesByDate = new Map<string, { amount: number, date: Date }>()
      filteredExpenses.forEach((expense) => {
        const expenseDate = safeParseDate(expense.date)
        const dateKey = timeframe === "year"
          ? format(expenseDate, "MMM yyyy")
          : format(expenseDate, "MMM d")

        if (expensesByDate.has(dateKey)) {
          expensesByDate.get(dateKey)!.amount += expense.amount
        } else {
          expensesByDate.set(dateKey, {
            amount: expense.amount,
            date: expenseDate
          })
        }
      })

      const sortedData = Array.from(expensesByDate.entries())
        .map(([name, { amount, date }]) => ({
          name,
          amount,
          sortDate: date
        }))
        .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())

      let runningTotal = 0
      const groupedData: ChartDataPoint[] = sortedData.map((item, index) => {
        runningTotal += item.amount

        return {
          name: item.name,
          amount: item.amount,
          average: runningTotal / (index + 1)
        }
      })

      setChartData(groupedData)
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
  }, [user, timeframe, mounted, expenses, expensesLoading])

  // ResponsiveContainer automatically handles window resize events
  // No manual resize handling needed

  // A failed load must not fall through to a chart of zeros - an empty
  // result and a failed request are different claims about the user's money.
  if (expensesError) {
    return <ChartError height={isMobile ? 280 : 400} label="spending data" onRetry={() => refetchExpenses()} />
  }

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
      <EmptyState
        height={isMobile ? 280 : 400}
        title="No expense data available"
        description="Add some expenses to see spending trends"
      />
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
              interval="preserveStartEnd"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 9 : 12 }}
              tickFormatter={(value) => isMobile ? formatCompact(value) : formatCurrency(value, { decimals: 0 })}
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
                        <p className="text-cream text-sm">Amount: {formatCurrency(Number(payload[0].value))}</p>
                      </div>
                      {payload[1] && (
                        <div className="flex items-center mt-1">
                          <div className="h-2 w-2 rounded-full bg-cream/50 mr-1"></div>
                          <p className="text-cream/80 text-sm">Moving Average: {formatCurrency(Number(payload[1].value))}</p>
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