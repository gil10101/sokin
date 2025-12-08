"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useIsMobile } from '../../hooks/use-mobile'
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

interface Expense {
  id: string
  name: string
  amount: number
  date: string
  category: string
  userId: string
}

interface OverviewAnalyticsProps {
  expenses?: Expense[]
}

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: string | number | Date | { toDate(): Date } | null | undefined): Date => {
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

    return new Date()
  }
}

export function OverviewAnalytics({ expenses }: OverviewAnalyticsProps) {
  const isMobile = useIsMobile()

  // Trend analysis data
  const trendData = useMemo(() => {
    // Ensure expenses is always an array
    const safeExpenses = expenses || []
    
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), 11 - i)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      
      const monthExpenses = safeExpenses.filter(expense => {
        if (!expense.date) return false
        
        const expenseDate = safeParseDate(expense.date)
        // Check if the date is valid
        if (isNaN(expenseDate.getTime())) return false
        
        return expenseDate >= monthStart && expenseDate <= monthEnd
      })
      
      const totalSpent = monthExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount || 0), 0)
      
      return {
        month: format(date, 'MMM yyyy'),
        totalSpent,
        transactionCount: monthExpenses.length
      }
    })
    
    return monthlyData
  }, [expenses])

  return (
    <div className="space-y-8">
      {/* Spending Trend */}
      <Card className="bg-cream/5 border-cream/20">
        <CardHeader className="pb-6">
          <CardTitle className="text-xl text-cream/90">Spending Trend</CardTitle>
          <p className="text-sm text-cream/60">Monthly spending over the last 12 months</p>
        </CardHeader>
        <CardContent className="pb-6">
          <ResponsiveContainer width="100%" height={isMobile ? 320 : 400}>
            <AreaChart 
              data={trendData}
              margin={isMobile ? { top: 10, right: 10, left: -20, bottom: 50 } : { top: 10, right: 30, left: 0, bottom: 85 }}
            >
              <defs>
                <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgba(245, 245, 240, 0.3)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="rgba(245, 245, 240, 0.1)" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 245, 240, 0.1)" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 9 : 12 }}
                axisLine={false}
                tickLine={false}
                interval={isMobile ? 2 : 0}
                angle={isMobile ? -45 : -35}
                textAnchor="end"
                height={isMobile ? 60 : 80}
              />
              <YAxis 
                tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 9 : 12 }}
                axisLine={false}
                tickLine={false}
                width={isMobile ? 35 : 60}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-dark border border-cream/10 p-2 rounded-md shadow-md">
                        <p className="text-cream font-medium">{payload[0].payload.month}</p>
                        <div className="flex items-center mt-1">
                          <div className="h-2 w-2 rounded-full bg-cream/80 mr-1"></div>
                          <p className="text-cream text-sm">Amount: ${Number(payload[0].value).toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area 
                type="monotone" 
                dataKey="totalSpent" 
                stroke="rgba(245, 245, 240, 0.8)" 
                fill="url(#colorSpending)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
