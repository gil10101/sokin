"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useIsMobile } from '../../hooks/use-mobile'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useAuth } from "../../contexts/auth-context"
import { OverviewAnalytics } from './overview-analytics'
import { TrendsAnalytics } from './trends-analytics'
import { SpendingHeatmapAnalytics } from './spending-heatmap-analytics'
import { CategoryComparisonChart } from './category-comparison-chart'
import { StackedBarChart } from './stacked-bar-chart'

interface AdvancedAnalyticsProps {
  budgets: Budget[]
  timeframe?: string
}

interface Budget {
  id: string
  name?: string
  amount: number
  currentSpent?: number
  period?: string
  categories?: string[]
  startDate?: string
  endDate?: string
  userId?: string
}

interface Expense {
  id: string
  name: string
  amount: number
  date: string
  category: string
  userId: string
}

interface SpendingInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'forecast'
  title: string
  description: string
  severity: 'info' | 'warning' | 'danger'
  value?: number
  change?: number
}

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: unknown): Date => {
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

export function AdvancedAnalytics({ budgets, timeframe = "6months" }: AdvancedAnalyticsProps) {
  const { user } = useAuth()
  const [insights, setInsights] = useState<SpendingInsight[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [mounted, setMounted] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchExpenseData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      // Fetch expenses from Firebase
      const expensesRef = collection(db, "expenses")
      const q = query(expensesRef, where("userId", "==", user.uid))

      const querySnapshot = await getDocs(q)
      const allExpenses = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[]

      setExpenses(allExpenses)

    } catch (error) {

      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [user, timeframe])

  useEffect(() => {
    if (user && mounted) {
      fetchExpenseData()
    }
  }, [user, mounted, timeframe, fetchExpenseData])

  // Category comparison data - include all categories with expenses
  const categoryComparisonData = useMemo(() => {
    const categoryTotals = expenses.reduce((acc, expense) => {
      if (!expense.category || !expense.amount) return acc
      acc[expense.category] = (acc[expense.category] || 0) + Math.abs(expense.amount || 0)
      return acc
    }, {} as Record<string, number>)

    const result = Object.entries(categoryTotals)
      .filter(([_, amount]) => amount > 0) // Only include categories with actual spending
      .map(([category, amount]) => ({ category, amount: amount as number }))
      .sort((a, b) => b.amount - a.amount) // Sort by highest spending first
    

    return result
  }, [expenses])

  // Generate insights based on expenses and budgets
  useEffect(() => {
    if (expenses.length === 0) return

    const generateInsights = () => {
      const newInsights: SpendingInsight[] = []
      
      // Calculate basic monthly data
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const date = subMonths(new Date(), 11 - i)
        const monthStart = startOfMonth(date)
        const monthEnd = endOfMonth(date)
        
        const monthExpenses = expenses.filter(expense => {
          if (!expense.date) return false
          
          const expenseDate = safeParseDate(expense.date)
          if (isNaN(expenseDate.getTime())) return false
          
          return expenseDate >= monthStart && expenseDate <= monthEnd
        })
        
        return {
          month: format(date, 'MMM yyyy'),
          totalSpent: monthExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount || 0), 0)
        }
      })
      
      // Calculate month-over-month change
      if (monthlyData.length >= 2) {
        const currentMonth = monthlyData[monthlyData.length - 1]
        const previousMonth = monthlyData[monthlyData.length - 2]
        const change = previousMonth.totalSpent > 0 
          ? ((currentMonth.totalSpent - previousMonth.totalSpent) / previousMonth.totalSpent) * 100 
          : 0
        
        newInsights.push({
          type: 'trend',
          title: 'Monthly Spending Trend',
          description: `Your spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% this month`,
          severity: change > 20 ? 'warning' : change > 50 ? 'danger' : 'info',
          change
        })
      }
      
      // Detect spending anomalies
      const avgMonthlySpending = monthlyData.reduce((sum, month) => sum + month.totalSpent, 0) / monthlyData.length
      const currentSpending = monthlyData[monthlyData.length - 1]?.totalSpent || 0
      
      if (currentSpending > avgMonthlySpending * 1.5) {
        newInsights.push({
          type: 'anomaly',
          title: 'Unusual Spending Detected',
          description: `This month's spending is ${((currentSpending / avgMonthlySpending - 1) * 100).toFixed(1)}% higher than average`,
          severity: 'warning',
          value: currentSpending
        })
      }
      
      // Budget variance analysis
      budgets?.forEach(budget => {
        if (budget.currentSpent && budget.currentSpent > budget.amount * 0.9) {
          newInsights.push({
            type: 'pattern',
            title: `${budget.name || 'Budget'} Alert`,
            description: `You've used ${((budget.currentSpent / budget.amount) * 100).toFixed(1)}% of your budget`,
            severity: budget.currentSpent > budget.amount ? 'danger' : 'warning',
            value: budget.currentSpent
          })
        }
      })
      
      // Forecast next month
      const recentMonths = monthlyData.slice(-3)
      const trend = recentMonths.reduce((acc, month, index) => {
        return acc + month.totalSpent * (index + 1)
      }, 0) / 6
      
      newInsights.push({
        type: 'forecast',
        title: 'Next Month Forecast',
        description: `Based on current trends, you're projected to spend approximately $${trend.toLocaleString()} next month`,
        severity: 'info',
        value: trend
      })
      
      setInsights(newInsights)
    }
    
    generateInsights()
  }, [expenses, budgets])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'warning': return AlertTriangle
      case 'danger': return TrendingDown
      default: return TrendingUp
    }
  }

  // Show loading state until mobile detection is initialized
  if (!mounted || typeof isMobile === 'undefined' || loading) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-cream/5 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-cream/5 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Insights Cards */}
      <div className="grid grid-cols-1 gap-6">
        {insights.map((insight, index) => {
          const Icon = getSeverityIcon(insight.severity)
          return (
            <Card key={index} className="border-l-4 border-l-cream/30 bg-cream/5 h-full">
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="h-10 w-10 rounded-full bg-cream/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-cream/60" />
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-cream/80 leading-tight">{insight.title}</p>
                    <p className="text-xs text-cream/60 leading-relaxed">{insight.description}</p>
                    {insight.value && (
                      <p className="text-xl font-bold text-cream/90 mt-3">${insight.value.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-cream/5 h-12">
          <TabsTrigger value="overview" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10 text-xs lg:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="trends" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10 text-xs lg:text-sm">Trends</TabsTrigger>
          <TabsTrigger value="categories" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10 text-xs lg:text-sm">Categories</TabsTrigger>
          <TabsTrigger value="monthly" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10 text-xs lg:text-sm">Monthly</TabsTrigger>
          <TabsTrigger value="patterns" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10 text-xs lg:text-sm">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <OverviewAnalytics expenses={expenses} />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <TrendsAnalytics expenses={expenses} />
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card className="bg-cream/5 border-cream/20">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl text-cream/90">Category Comparison</CardTitle>
              <p className="text-sm text-cream/60">Compare spending across different categories</p>
            </CardHeader>
            <CardContent className="pb-6">
              {categoryComparisonData.length === 0 ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-cream/60 mb-1 text-sm">No category data available</div>
                    <div className="text-xs text-cream/40">Add expenses to see breakdown</div>
                  </div>
                </div>
              ) : (
                <CategoryComparisonChart data={categoryComparisonData} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <Card className="bg-cream/5 border-cream/20">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-cream/90">Monthly Category Breakdown</CardTitle>
                  <p className="text-sm text-cream/60">Monthly spending over the last 6 months by category</p>
                </div>
                <span className="text-xs bg-cream/10 text-cream/80 px-2 py-1 rounded-full">Last 6 Months</span>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="h-96">
                <StackedBarChart timeframe={timeframe} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <SpendingHeatmapAnalytics expenses={expenses} />
        </TabsContent>
      </Tabs>
    </div>
  )
} 