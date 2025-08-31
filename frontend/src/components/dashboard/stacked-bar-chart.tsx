"use client"

import React, { useEffect, useState, useRef } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart"
import { LoadingSpinner } from "../../components/ui/loading-spinner"
import { motion } from "framer-motion"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useExpensesData } from "../../hooks/use-expenses-data"
import { useAuth } from "../../contexts/auth-context"
import { useViewport } from "../../hooks/use-mobile"
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns"

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: string | number | Date | { toDate(): Date } | null | undefined): Date => {
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

interface Expense {
  id: string
  name: string
  amount: number
  date: string
  category: string
  userId: string
}

interface ChartDataPoint {
  month: string
  [key: string]: string | number // Dynamic categories
}

interface StackedBarChartProps {
  timeframe?: string
}

// Category colors - solid colors for better visibility
const categoryColors: Record<string, string> = {
  "Food & Dining": "#f5f5f0",
  "Dining": "#f5f5f0", 
  "Transportation": "#e1e1d7",
  "Shopping": "#cdcdc3",
  "Entertainment": "#b9b9af",
  "Bills & Utilities": "#a5a59b",
  "Healthcare": "#919187",
  "Travel": "#7d7d73",
  "Education": "#69695f",
  "Personal Care": "#55554b",
  "Business": "#d2d2c8",
  "Gifts & Donations": "#bebebc",
  "Other": "#414137",
}

export function StackedBarChart({ timeframe = "year" }: StackedBarChartProps) {
  const { user } = useAuth()
  const { isMobile } = useViewport()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const chartRef = useRef<HTMLDivElement>(null)

  const { data: allExpenses = [], isLoading: expensesLoading } = useExpensesData()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user && mounted && !expensesLoading) {
      processExpenseData()
    }
  }, [user, mounted, timeframe, expensesLoading, allExpenses])

  const processExpenseData = () => {
    if (!user) return

    setLoading(true)
    try {
      const endDate = new Date()
      const startDate = subMonths(endDate, 6)

      const filteredExpenses = (allExpenses as Expense[]).filter((expense) => {
        const expenseDate = safeParseDate(expense.date)
        return expenseDate >= startDate && expenseDate <= endDate
      })

      const uniqueCategories = Array.from(new Set(filteredExpenses.map(expense => expense.category)))
      setCategories(uniqueCategories)

      const monthIntervals = eachMonthOfInterval({ start: startDate, end: endDate })

      const groupedData = monthIntervals.map((monthDate) => {
        const monthStart = startOfMonth(monthDate)
        const monthEnd = endOfMonth(monthDate)

        const monthExpenses = filteredExpenses.filter((expense) => {
          const expenseDate = safeParseDate(expense.date)
          return expenseDate >= monthStart && expenseDate <= monthEnd
        })

        const monthData: ChartDataPoint = {
          month: format(monthDate, "MMM yyyy"),
        }

        uniqueCategories.forEach((category) => {
          const categoryTotal = monthExpenses
            .filter(expense => expense.category === category)
            .reduce((sum, expense) => sum + Math.abs(expense.amount), 0)
          monthData[category] = categoryTotal
        })

        return monthData
      })

      const dataWithValues = groupedData.filter(monthData => 
        uniqueCategories.some(category => (monthData[category] as number) > 0)
      )
      const reversedData = dataWithValues.reverse()
      setChartData(reversedData)
    } catch (error) {
      setChartData([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  // Only handle resize without setting state
  useEffect(() => {
    if (!mounted) return

    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.style.display = 'none'
        void chartRef.current.offsetHeight
        chartRef.current.style.display = ''
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [mounted])

  if (!mounted || loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingSpinner size="sm" />
        </motion.div>
      </div>
    )
  }

  if (chartData.length === 0 || categories.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-cream/60 mb-1 text-sm">No data available</div>
          <div className="text-xs text-cream/40">Add expenses to see breakdown</div>
        </div>
      </div>
    )
  }

  // Check if all data points have zero values
  const hasData = chartData.some(monthData => 
    categories.some(category => (monthData[category] as number) > 0)
  )

  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-cream/60 mb-1 text-sm">No data for period</div>
          <div className="text-xs text-cream/40">Add expenses to view</div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      ref={chartRef}
      className="h-full w-full min-w-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ChartContainer
        config={categories.reduce((config, category) => ({
          ...config,
          [category]: {
            label: category,
            color: categoryColors[category] || "#f5f5f0",
          }
        }), {})}
        className="h-full w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={isMobile ? { top: 8, right: 8, left: 45, bottom: 8 } : { top: 12, right: 12, left: 65, bottom: 12 }}
            barCategoryGap="8%"
            barSize={isMobile ? 24 : 32}
          >
            <defs>
              {categories.map((category, index) => {
                const baseColor = categoryColors[category] || "#f5f5f0"
                const gradientId = `gradient-${category.replace(/\s+/g, '-').toLowerCase()}`
                return (
                  <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={baseColor} stopOpacity={1} />
                    <stop offset="100%" stopColor={baseColor} stopOpacity={0.9} />
                  </linearGradient>
                )
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.08)" />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 9 : 12 }}
              tickFormatter={(value) => isMobile ? `$${(value/1000).toFixed(0)}k` : `$${value}`}
            />
            <YAxis
              type="category"
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 8 : 10 }}
              width={isMobile ? 40 : 60}
              interval={0}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const total = payload.reduce((sum, entry) => sum + (entry.value as number), 0)
                  return (
                    <div className="bg-dark border border-cream/10 p-3 rounded-lg shadow-lg backdrop-blur-sm">
                      <p className="text-cream font-medium mb-2">{label}</p>
                      <div className="flex items-center mb-3 pb-2 border-b border-cream/10">
                        <div className="h-2.5 w-2.5 rounded-full bg-cream/80 mr-2"></div>
                        <p className="text-cream text-sm font-medium">Total: ${total.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1.5">
                        {payload
                          .filter(entry => (entry.value as number) > 0)
                          .sort((a, b) => (b.value as number) - (a.value as number))
                          .map((entry, index) => {
                            const categoryName = entry.dataKey as string
                            const categoryColor = categoryColors[categoryName] || "#f5f5f0"
                            const value = entry.value as number
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
                            
                            return (
                              <div key={index} className="flex items-center justify-between gap-3">
                                <div className="flex items-center">
                                  <div 
                                    className="h-2.5 w-2.5 rounded-full mr-2" 
                                    style={{ backgroundColor: categoryColor }}
                                  ></div>
                                  <span className="text-cream/80 text-sm">{categoryName}</span>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-cream text-sm font-mono">${value.toLocaleString()}</span>
                                  <span className="text-cream/60 text-xs">({percentage}%)</span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            {categories.map((category, index) => {
              const color = categoryColors[category] || "#f5f5f0"
              const gradientId = `gradient-${category.replace(/\s+/g, '-').toLowerCase()}`

              return (
                <Bar
                  key={category}
                  dataKey={category}
                  stackId="a"
                  fill={`url(#${gradientId})`}
                  stroke="rgba(245, 245, 240, 0.2)"
                  strokeWidth={0.5}
                  radius={index === categories.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </motion.div>
  )
} 