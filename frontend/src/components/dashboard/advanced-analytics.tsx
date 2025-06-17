"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { useIsMobile } from '../../hooks/use-mobile'
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
  Bar
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
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

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
      setLoading(false)
    }
    
    generateInsights()
  }, [expenses, budgets, trendData])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'warning': return AlertTriangle
      case 'danger': return TrendingDown
      default: return TrendingUp
    }
  }

  // Show loading state until mobile detection is initialized
  if (typeof isMobile === 'undefined' || loading) {
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <TabsList className="grid w-full grid-cols-4 bg-cream/5 h-12">
          <TabsTrigger value="overview" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10">Overview</TabsTrigger>
          <TabsTrigger value="trends" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10">Trends</TabsTrigger>
          <TabsTrigger value="categories" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10">Categories</TabsTrigger>
          <TabsTrigger value="patterns" className="text-cream/70 data-[state=active]:bg-cream/10 data-[state=active]:text-cream/90 h-10">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Spending Trend */}
            <Card className="bg-cream/5 border-cream/20">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl text-cream/90">Spending Trend</CardTitle>
                <p className="text-sm text-cream/60">Monthly spending over the last 12 months</p>
              </CardHeader>
              <CardContent className="pb-6">
                <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgba(245, 245, 240, 0.3)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="rgba(245, 245, 240, 0.1)" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 245, 240, 0.1)" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
                      axisLine={false}
                      tickLine={false}
                      interval={isMobile ? 1 : 0}
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? "end" : "middle"}
                    />
                    <YAxis 
                      tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={isMobile ? 40 : 60}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Amount']}
                      contentStyle={{ 
                        backgroundColor: 'rgba(245, 245, 240, 0.95)', 
                        border: '1px solid rgba(245, 245, 240, 0.2)',
                        borderRadius: '12px',
                        color: 'rgba(0, 0, 0, 0.8)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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

            {/* Category Breakdown */}
            <Card className="bg-cream/5 border-cream/20">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl text-cream/90">Category Breakdown</CardTitle>
                <p className="text-sm text-cream/60">Top spending categories</p>
              </CardHeader>
              <CardContent className="pb-6">
                <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                  <PieChart>
                    <Pie
                      data={categoryComparisonData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isMobile ? 50 : 80}
                      outerRadius={isMobile ? 100 : 160}
                      paddingAngle={5}
                      dataKey="amount"
                    >
                      {categoryComparisonData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`rgba(245, 245, 240, ${0.8 - (index * 0.08)})`}
                          stroke="rgba(245, 245, 240, 0.2)"
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Amount']}
                      contentStyle={{ 
                        backgroundColor: 'rgba(245, 245, 240, 0.95)', 
                        border: '1px solid rgba(245, 245, 240, 0.2)',
                        borderRadius: '12px',
                        color: 'rgba(0, 0, 0, 0.8)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                      fontSize={isMobile ? 12 : 14}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="bg-cream/5 border-cream/20">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl text-cream/90">Monthly Spending Analysis</CardTitle>
              <p className="text-sm text-cream/60">Detailed monthly breakdown and trends</p>
            </CardHeader>
            <CardContent className="pb-6">
              <ResponsiveContainer width="100%" height={isMobile ? 350 : 500}>
                <BarChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: isMobile ? 40 : 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 245, 240, 0.1)" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
                    axisLine={false}
                    tickLine={false}
                    interval={isMobile ? 1 : 0}
                    angle={isMobile ? -45 : 0}
                    textAnchor={isMobile ? "end" : "middle"}
                    height={isMobile ? 60 : 30}
                  />
                  <YAxis 
                    tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={isMobile ? 40 : 60}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Total Spent']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(245, 245, 240, 0.95)', 
                      border: '1px solid rgba(245, 245, 240, 0.2)',
                      borderRadius: '12px',
                      color: 'rgba(0, 0, 0, 0.8)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card className="bg-cream/5 border-cream/20">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl text-cream/90">Category Comparison</CardTitle>
              <p className="text-sm text-cream/60">Compare spending across different categories</p>
            </CardHeader>
            <CardContent className="pb-6">
              <ResponsiveContainer width="100%" height={isMobile ? 350 : 500}>
                <BarChart data={categoryComparisonData} layout="horizontal" margin={{ top: 20, right: 30, left: isMobile ? 80 : 120, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 245, 240, 0.1)" />
                  <XAxis 
                    type="number" 
                    tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    dataKey="category" 
                    type="category" 
                    width={isMobile ? 80 : 120} 
                    tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: isMobile ? 10 : 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Amount']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(245, 245, 240, 0.95)', 
                      border: '1px solid rgba(245, 245, 240, 0.2)',
                      borderRadius: '12px',
                      color: 'rgba(0, 0, 0, 0.8)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="rgba(245, 245, 240, 0.6)" 
                    stroke="rgba(245, 245, 240, 0.8)" 
                    strokeWidth={1}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          {/* Spending Heatmap Calendar */}
          <Card className="bg-cream/5 border-cream/20">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl text-cream/90">Spending Heatmap</CardTitle>
              <p className="text-sm text-cream/60">Daily spending patterns over the last {isMobile ? '5 weeks' : '7 weeks'}</p>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="space-y-4">
                <div className={`grid grid-cols-7 gap-3 ${isMobile ? 'text-xs' : 'text-sm'} max-w-4xl mx-auto`}>
                  {(isMobile ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).map((day, index) => (
                    <div key={index} className={`text-center font-medium text-cream/60 ${isMobile ? 'p-2' : 'p-3'}`}>{day}</div>
                  ))}
                  {spendingHeatmapData.slice(isMobile ? -35 : -49).map((day, index) => {
                    const intensity = Math.min(day.amount / 100, 1) // Normalize intensity
                    return (
                      <div
                        key={index}
                        className={`aspect-square rounded-lg flex items-center justify-center ${isMobile ? 'text-xs' : 'text-sm'} cursor-pointer hover:scale-105 transition-all duration-200 font-medium`}
                        style={{
                          backgroundColor: `rgba(245, 245, 240, ${intensity * 0.6 + 0.1})`,
                          color: intensity > 0.3 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(245, 245, 240, 0.7)',
                          border: '1px solid rgba(245, 245, 240, 0.2)',
                          minHeight: isMobile ? '32px' : '48px'
                        }}
                        title={`${day.date}: $${day.amount.toFixed(2)} (${day.count} transactions)`}
                      >
                        {isMobile ? day.day.slice(-1) : day.day}
                      </div>
                    )
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-center space-x-4 pt-4 max-w-md mx-auto">
                  <span className="text-xs text-cream/60">Less</span>
                  <div className="flex space-x-1">
                    {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity, index) => (
                      <div 
                        key={index}
                        className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded-sm border border-cream/20`}
                        style={{ backgroundColor: `rgba(245, 245, 240, ${intensity * 0.6 + 0.1})` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-cream/60">More</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 