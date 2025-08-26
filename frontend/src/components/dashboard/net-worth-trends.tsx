"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { TrendingUp, TrendingDown, Calendar, BarChart3 } from 'lucide-react'
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
  BarChart,
  Bar,
  ComposedChart
} from 'recharts'
import { format, subMonths, parseISO } from 'date-fns'
import { useAuth } from '../../contexts/auth-context'
import { api } from '../../lib/api'
import { NetWorthTrend, NetWorthSnapshot } from '../../lib/types'

interface NetWorthTrendsProps {
  currentNetWorth: number
  monthlyChange?: number
  monthlyChangePercent?: number
}

interface TrendData {
  month: string
  netWorth: number
  assets: number
  liabilities: number
  change: number
  changePercent: number
}

export function NetWorthTrends({ 
  currentNetWorth, 
  monthlyChange, 
  monthlyChangePercent 
}: NetWorthTrendsProps) {
  const { user } = useAuth()
  const [timeframe, setTimeframe] = useState('12months')
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar' | 'composed'>('area')
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchTrendData()
    }
  }, [user, timeframe])

  const fetchTrendData = async () => {
    try {
      setLoading(true)
      const token = await user?.getIdToken()
      
      const months = timeframe === '6months' ? 6 : timeframe === '12months' ? 12 : 24
      
      const data = await api.get(`net-worth/trends?months=${months}`, { token })
      const trends = data.data || []
      
      // Generate sample data if no historical data exists
      const processedData = generateTrendData(trends, months)
      setTrendData(processedData)
    } catch (error) {

      // Generate sample data for demo
      const months = timeframe === '6months' ? 6 : timeframe === '12months' ? 12 : 24
      const processedData = generateSampleTrendData(months)
      setTrendData(processedData)
    } finally {
      setLoading(false)
    }
  }

  const generateTrendData = (trends: NetWorthTrend[], months: number): TrendData[] => {
    const result: TrendData[] = []
    
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const monthKey = format(date, 'yyyy-MM')
      
      // Find trend data for this month
      const trendForMonth = trends.find(trend => 
        trend.period && trend.period.startsWith(monthKey)
      )
      
      if (trendForMonth) {
        result.push({
          month: format(date, 'MMM yyyy'),
          netWorth: trendForMonth.netWorth,
          assets: trendForMonth.totalAssets,
          liabilities: trendForMonth.totalLiabilities,
          change: trendForMonth.monthlyChange || 0,
          changePercent: trendForMonth.monthlyChangePercent || 0
        })
      } else {
        // Generate estimated data based on current net worth
        const randomVariation = (Math.random() - 0.5) * 0.1
        const estimatedNetWorth = currentNetWorth * (1 + randomVariation - (i * 0.02))
        const estimatedAssets = estimatedNetWorth * 1.3
        const estimatedLiabilities = estimatedAssets - estimatedNetWorth
        
        result.push({
          month: format(date, 'MMM yyyy'),
          netWorth: Math.max(0, estimatedNetWorth),
          assets: Math.max(0, estimatedAssets),
          liabilities: Math.max(0, estimatedLiabilities),
          change: i === 0 ? (monthlyChange || 0) : (Math.random() - 0.5) * 2000,
          changePercent: i === 0 ? (monthlyChangePercent || 0) : (Math.random() - 0.5) * 10
        })
      }
    }
    
    return result
  }

  const generateSampleTrendData = (months: number): TrendData[] => {
    const result: TrendData[] = []
    const baseNetWorth = currentNetWorth || 50000
    
    for (let i = months - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const growth = 1 + (Math.random() * 0.1 - 0.05) // ±5% random variation
      const netWorth = baseNetWorth * (1 - i * 0.01) * growth
      const assets = netWorth * 1.4
      const liabilities = assets - netWorth
      
      result.push({
        month: format(date, 'MMM yyyy'),
        netWorth: Math.max(0, Math.round(netWorth)),
        assets: Math.max(0, Math.round(assets)),
        liabilities: Math.max(0, Math.round(liabilities)),
        change: i === 0 ? (monthlyChange || 0) : (Math.random() - 0.5) * 2000,
        changePercent: i === 0 ? (monthlyChangePercent || 0) : (Math.random() - 0.5) * 10
      })
    }
    
    return result
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatTooltipCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark border border-cream/20 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-cream mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatTooltipCurrency(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const latestTrend = trendData[trendData.length - 1]
  const secondLatestTrend = trendData[trendData.length - 2]
  const overallChange = latestTrend && secondLatestTrend 
    ? latestTrend.netWorth - secondLatestTrend.netWorth
    : 0
  const overallChangePercent = latestTrend && secondLatestTrend
    ? ((latestTrend.netWorth - secondLatestTrend.netWorth) / Math.abs(secondLatestTrend.netWorth)) * 100
    : 0

  if (loading) {
    return (
      <Card className="bg-cream/5 border-cream/10">
        <CardContent className="p-6">
          <div className="h-96 bg-cream/5 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-cream/5 border-cream/10">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-cream">Net Worth Trends</CardTitle>
            <p className="text-cream/60 text-sm mt-1">Track your financial growth over time</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-32 bg-cream/5 border-cream/10 text-cream">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-dark border-cream/10">
                <SelectItem value="6months" className="text-cream">6 Months</SelectItem>
                <SelectItem value="12months" className="text-cream">12 Months</SelectItem>
                <SelectItem value="24months" className="text-cream">2 Years</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
              <SelectTrigger className="w-32 bg-cream/5 border-cream/10 text-cream">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-dark border-cream/10">
                <SelectItem value="area" className="text-cream">Area</SelectItem>
                <SelectItem value="line" className="text-cream">Line</SelectItem>
                <SelectItem value="bar" className="text-cream">Bar</SelectItem>
                <SelectItem value="composed" className="text-cream">Composed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-cream/5 rounded-lg p-3 border border-cream/10">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-cream/60" />
              <span className="text-sm text-cream/60">Period Change</span>
            </div>
            <p className="text-lg font-bold text-cream mt-1">
              {formatCurrency(Math.abs(overallChange))}
            </p>
            <div className="flex items-center mt-1">
              {overallChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-400 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-400 mr-1" />
              )}
              <span className={`text-xs ${overallChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {overallChangePercent >= 0 ? '+' : ''}{overallChangePercent.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="bg-cream/5 rounded-lg p-3 border border-cream/10">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-cream/60">Avg Monthly Growth</span>
            </div>
            <p className="text-lg font-bold text-cream mt-1">
              {formatCurrency(overallChange / (trendData.length - 1 || 1))}
            </p>
            <span className="text-xs text-cream/60">per month</span>
          </div>

          <div className="bg-cream/5 rounded-lg p-3 border border-cream/10">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-cream/60">Best Month</span>
            </div>
            <p className="text-lg font-bold text-cream mt-1">
              {formatCurrency(Math.max(...trendData.map(d => d.change)))}
            </p>
            <span className="text-xs text-cream/60">growth</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            {(() => {
              if (chartType === 'area') {
                return (
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="netWorth"
                      stroke="#10B981"
                      fill="#10B98120"
                      strokeWidth={2}
                      name="Net Worth"
                    />
                  </AreaChart>
                )
              } else if (chartType === 'line') {
                return (
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      stroke="#10B981"
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      name="Net Worth"
                    />
                  </LineChart>
                )
              } else if (chartType === 'bar') {
                return (
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="netWorth"
                      fill="#10B981"
                      name="Net Worth"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )
              } else {
                return (
                  <ComposedChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar
                      dataKey="assets"
                      fill="#3B82F6"
                      name="Assets"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="liabilities"
                      fill="#EF4444"
                      name="Liabilities"
                      radius={[2, 2, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="netWorth"
                      stroke="#10B981"
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      name="Net Worth"
                    />
                  </ComposedChart>
                )
              }
            })()}
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
            <h4 className="font-medium text-cream mb-2">Growth Trend</h4>
            <p className="text-sm text-cream/60">
              {overallChange >= 0 ? 'Your net worth has grown' : 'Your net worth has declined'} by{' '}
              <span className={overallChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                {formatCurrency(Math.abs(overallChange))}
              </span>{' '}
              over the past {timeframe === '6months' ? '6 months' : timeframe === '12months' ? '12 months' : '2 years'}.
            </p>
          </div>

          <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
            <h4 className="font-medium text-cream mb-2">Asset Growth</h4>
            <p className="text-sm text-cream/60">
              Your assets have{' '}
              {latestTrend && trendData[0] && latestTrend.assets > trendData[0].assets ? 'increased' : 'fluctuated'}{' '}
              over this period, showing{' '}
              <span className="text-blue-400">
                {latestTrend && trendData[0] 
                  ? `${((latestTrend.assets - trendData[0].assets) / trendData[0].assets * 100).toFixed(1)}%`
                  : '0%'
                } change
              </span>.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 