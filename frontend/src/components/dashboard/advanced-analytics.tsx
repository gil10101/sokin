"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { TrendingUp, TrendingDown, DollarSign, Calendar, Target, AlertTriangle } from 'lucide-react'
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Sankey,
  Treemap
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'

interface AdvancedAnalyticsProps {
  expenses: any[]
  budgets: any[]
  timeframe: string
}

interface SpendingInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'forecast'
  title: string
  description: string
  severity: 'info' | 'warning' | 'danger'
  value?: number
  change?: number
}

export function AdvancedAnalytics({ expenses, budgets, timeframe }: AdvancedAnalyticsProps) {
  const [insights, setInsights] = useState<SpendingInsight[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Process spending data for heatmap
  const spendingHeatmapData = useMemo(() => {
    const endDate = new Date()
    const startDate = subMonths(endDate, 12)
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate })
    
    const dailySpending = dateRange.map(date => {
      const dayExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date)
        return format(expenseDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      })
      
      const totalSpent = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0)
      
      return {
        date: format(date, 'yyyy-MM-dd'),
        day: format(date, 'dd'),
        month: format(date, 'MMM'),
        year: format(date, 'yyyy'),
        amount: totalSpent,
        count: dayExpenses.length
      }
    })
    
    return dailySpending
  }, [expenses])

  // Sankey diagram data for money flow
  const sankeyData = useMemo(() => {
    const incomeCategories = ['Salary', 'Freelance', 'Investments', 'Other Income']
    const expenseCategories = [...new Set(expenses.map(e => e.category))]
    
    const nodes = [
      ...incomeCategories.map(cat => ({ name: cat, category: 'income' })),
      ...expenseCategories.map(cat => ({ name: cat, category: 'expense' }))
    ]
    
    const links = expenseCategories.map(category => {
      const categoryTotal = expenses
        .filter(e => e.category === category)
        .reduce((sum, e) => sum + e.amount, 0)
      
      return {
        source: 0, // Assuming primary income source
        target: incomeCategories.length + expenseCategories.indexOf(category),
        value: categoryTotal
      }
    })
    
    return { nodes, links }
  }, [expenses])

  // Category comparison data
  const categoryComparisonData = useMemo(() => {
    const categoryTotals = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount
      return acc
    }, {} as Record<string, number>)

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount: amount as number, percentage: 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }, [expenses])

  // Trend analysis data
  const trendData = useMemo(() => {
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const date = subMonths(new Date(), 11 - i)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      
      const monthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date)
        return expenseDate >= monthStart && expenseDate <= monthEnd
      })
      
      const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0)
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

  // Generate insights
  useEffect(() => {
    const generateInsights = () => {
      const newInsights: SpendingInsight[] = []
      
      // Calculate month-over-month change
      if (trendData.length >= 2) {
        const currentMonth = trendData[trendData.length - 1]
        const previousMonth = trendData[trendData.length - 2]
        const change = ((currentMonth.totalSpent - previousMonth.totalSpent) / previousMonth.totalSpent) * 100
        
        newInsights.push({
          type: 'trend',
          title: 'Monthly Spending Trend',
          description: `Your spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% this month`,
          severity: change > 20 ? 'warning' : change > 50 ? 'danger' : 'info',
          change
        })
      }
      
      // Detect spending anomalies
      const avgMonthlySpending = trendData.reduce((sum, month) => sum + month.totalSpent, 0) / trendData.length
      const currentSpending = trendData[trendData.length - 1]?.totalSpent || 0
      
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
      budgets.forEach(budget => {
        if (budget.currentSpent > budget.amount * 0.9) {
          newInsights.push({
            type: 'pattern',
            title: `${budget.name} Budget Alert`,
            description: `You've used ${((budget.currentSpent / budget.amount) * 100).toFixed(1)}% of your budget`,
            severity: budget.currentSpent > budget.amount ? 'danger' : 'warning',
            value: budget.currentSpent
          })
        }
      })
      
      // Forecast next month
      const trend = trendData.slice(-3).reduce((acc, month, index) => {
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
  }, [expenses, budgets, trendData])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'danger': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'warning': return AlertTriangle
      case 'danger': return TrendingDown
      default: return TrendingUp
    }
  }

  return (
    <div className="space-y-6">
      {/* Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {insights.map((insight, index) => {
          const Icon = getSeverityIcon(insight.severity)
          return (
            <Card key={index} className={`border-l-4 ${getSeverityColor(insight.severity)}`}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Icon className="h-5 w-5 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{insight.title}</p>
                    <p className="text-xs opacity-80">{insight.description}</p>
                    {insight.value && (
                      <p className="text-lg font-bold">${insight.value.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Spending Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Amount']} />
                    <Area type="monotone" dataKey="totalSpent" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryComparisonData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="amount"
                    >
                      {categoryComparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Amount']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Spending Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="amount" orientation="left" />
                  <YAxis yAxisId="count" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="amount" dataKey="totalSpent" fill="#3b82f6" name="Total Spent" />
                  <Line yAxisId="count" type="monotone" dataKey="transactionCount" stroke="#ef4444" strokeWidth={2} name="Transactions" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={categoryComparisonData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="category" type="category" width={100} />
                  <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, 'Amount']} />
                  <Bar dataKey="amount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          {/* Spending Heatmap Calendar */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-xs">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-medium p-2">{day}</div>
                ))}
                {spendingHeatmapData.slice(-49).map((day, index) => {
                  const intensity = Math.min(day.amount / 100, 1) // Normalize intensity
                  return (
                    <div
                      key={index}
                      className={`aspect-square rounded-sm flex items-center justify-center text-xs cursor-pointer hover:scale-110 transition-transform`}
                      style={{
                        backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                        color: intensity > 0.5 ? 'white' : 'black'
                      }}
                      title={`${day.date}: $${day.amount.toFixed(2)}`}
                    >
                      {day.day}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 