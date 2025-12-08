"use client"

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useIsMobile } from '../../hooks/use-mobile'
import { 
  ResponsiveContainer, 
  BarChart,
  Bar,
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

interface TrendsAnalyticsProps {
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

export function TrendsAnalytics({ expenses }: TrendsAnalyticsProps) {
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
      const avgDaily = totalSpent / date.getDate()
      
      return {
        month: format(date, 'MMM yyyy'),
        totalSpent,
        avgDaily,
        transactionCount: monthExpenses.length
      }
    })
    
    return monthlyData
  }, [expenses])

  return (
    <Card className="bg-cream/5 border-cream/20">
      <CardHeader className="pb-6">
        <CardTitle className="text-xl text-cream/90">Monthly Spending Analysis</CardTitle>
        <p className="text-sm text-cream/60">Detailed monthly breakdown and trends</p>
      </CardHeader>
      <CardContent className="pb-6">
        <ResponsiveContainer width="100%" height={isMobile ? 350 : 500}>
          <BarChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: isMobile ? 50 : 85 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 245, 240, 0.1)" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
              interval={isMobile ? 1 : 0}
              angle={isMobile ? -45 : -35}
              textAnchor="end"
              height={isMobile ? 60 : 80}
            />
            <YAxis 
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 40 : 60}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-dark border border-cream/10 p-2 rounded-md shadow-md">
                      <p className="text-cream font-medium">{payload[0].payload.month}</p>
                      <div className="flex items-center mt-1">
                        <div className="h-2 w-2 rounded-full bg-cream/80 mr-1"></div>
                        <p className="text-cream text-sm">Total Spent: ${Number(payload[0].value).toLocaleString()}</p>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar 
              dataKey="totalSpent" 
              fill="rgba(245, 245, 240, 0.6)" 
              stroke="rgba(245, 245, 240, 0.8)" 
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
