"use client"

import React, { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { TrendingUp, TrendingDown, Calendar, BarChart3, LineChart as LineChartIcon, AlertCircle } from 'lucide-react'
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
import { format, parseISO } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { api } from '@/lib/api'
import { NetWorthTrend } from '@/lib/types'
import { useCurrency } from "@/hooks/use-currency"
import { EmptyState } from "./empty-state"

/**
 * Renders the user's recorded net worth history.
 *
 * Every point on this chart is a real `netWorthSnapshots` document. This
 * component deliberately does NOT interpolate, estimate, or back-fill months
 * that have no snapshot: an invented data point on a financial chart is
 * indistinguishable from a real one to the person reading it.
 */

const MONTHS_BY_TIMEFRAME = {
  '6months': 6,
  '12months': 12,
  '24months': 24,
} as const

type Timeframe = keyof typeof MONTHS_BY_TIMEFRAME
type ChartType = 'line' | 'area' | 'bar' | 'composed'

const EMPTY_TRENDS: NetWorthTrend[] = []

interface ChartPoint {
  month: string
  netWorth: number
  assets: number
  liabilities: number
  change: number
  changePercent: number
}

/** "2026-07" -> "Jul 2026"; falls back to the raw period if unparseable. */
function formatPeriodLabel(period: string): string {
  const parsed = parseISO(`${period}-01`)
  return Number.isNaN(parsed.getTime()) ? period : format(parsed, 'MMM yyyy')
}

/**
 * Declared at module scope so its identity is stable across renders - recharts
 * remounts the tooltip subtree whenever the component type changes. The
 * currency formatter arrives as a prop; recharts clones this element and adds
 * `active` / `payload` / `label`.
 */
function NetWorthTooltip({ active, payload, label, formatValue }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
  formatValue: (value: number) => string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-dark border border-cream/20 rounded-lg p-3 shadow-lg">
      <p className="font-medium text-cream mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatValue(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function NetWorthTrends() {
  const { format: formatCurrency, formatCompact } = useCurrency()
  const { user } = useAuth()
  const [timeframe, setTimeframe] = useState<Timeframe>('12months')
  const [chartType, setChartType] = useState<ChartType>('area')

  const months = MONTHS_BY_TIMEFRAME[timeframe]

  const {
    data: trends = EMPTY_TRENDS,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['net-worth-trends', user?.uid, months],
    queryFn: async () => {
      const token = await user?.getIdToken()
      const response = await api.get(`net-worth/trends?months=${months}`, { token }) as { data?: NetWorthTrend[] }
      return response.data ?? []
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const chartData = useMemo<ChartPoint[]>(
    () =>
      trends.map((trend) => ({
        month: formatPeriodLabel(trend.period),
        netWorth: trend.netWorth,
        assets: trend.totalAssets,
        liabilities: trend.totalLiabilities,
        change: trend.monthlyChange,
        changePercent: trend.monthlyChangePercent,
      })),
    [trends]
  )

  /**
   * A trend needs two points to exist. With fewer, every derived figure is
   * undefined rather than zero - we render "-" instead of a number the user
   * would read as "no growth".
   */
  const stats = useMemo(() => {
    if (chartData.length < 2) {
      return null
    }

    const first = chartData[0]
    const last = chartData[chartData.length - 1]
    const intervals = chartData.length - 1

    const periodChange = last.netWorth - first.netWorth
    const periodChangePercent =
      first.netWorth !== 0 ? (periodChange / Math.abs(first.netWorth)) * 100 : null
    const assetChangePercent =
      first.assets !== 0 ? ((last.assets - first.assets) / Math.abs(first.assets)) * 100 : null

    // The first snapshot in the window has no predecessor inside it, so its
    // monthlyChange is 0 by definition - excluded from "best month".
    const bestMonth = Math.max(...chartData.slice(1).map((point) => point.change))

    return {
      periodChange,
      periodChangePercent,
      avgMonthlyGrowth: periodChange / intervals,
      bestMonth,
      assetChangePercent,
      rangeLabel: `${first.month} - ${last.month}`,
    }
  }, [chartData])

  const formatTooltipCurrency = useCallback(
    (value: number): string => formatCurrency(value, { decimals: 0 }),
    [formatCurrency]
  )

  const tooltip = <NetWorthTooltip formatValue={formatTooltipCurrency} />

  if (isLoading) {
    return (
      <Card className="bg-cream/5 border-cream/10">
        <CardContent className="p-6">
          <div className="h-96 bg-cream/5 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="bg-cream/5 border-cream/10">
        <CardContent className="p-6">
          <div className="h-96 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-10 w-10 text-red-400/80 mb-3" />
            <p className="text-cream font-medium">Couldn&apos;t load your net worth history</p>
            <p className="text-sm text-cream/60 mt-1 max-w-sm">
              Your data is safe - this chart just failed to load.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-cream/20 text-cream hover:bg-cream/10"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? 'Retrying...' : 'Try again'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card className="bg-cream/5 border-cream/10">
        <CardContent className="p-6">
          <EmptyState
            height={384}
            icon={LineChartIcon}
            title="No history recorded yet"
            description="Sokin saves a snapshot of your net worth each month as you update your assets and liabilities. Your first snapshot appears here once you add one."
          />
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
            <p className="text-cream/60 text-sm mt-1">
              {stats
                ? `Recorded snapshots, ${stats.rangeLabel}`
                : 'Track your financial growth over time'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={timeframe} onValueChange={(value: Timeframe) => setTimeframe(value)}>
              <SelectTrigger className="w-32 bg-cream/5 border-cream/10 text-cream">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-dark border-cream/10">
                <SelectItem value="6months" className="text-cream">6 Months</SelectItem>
                <SelectItem value="12months" className="text-cream">12 Months</SelectItem>
                <SelectItem value="24months" className="text-cream">2 Years</SelectItem>
              </SelectContent>
            </Select>

            <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
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
              {stats ? formatCurrency(Math.abs(stats.periodChange)) : '—'}
            </p>
            <div className="flex items-center mt-1">
              {stats ? (
                <>
                  {stats.periodChange >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-400 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400 mr-1" />
                  )}
                  <span className={`text-xs ${stats.periodChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stats.periodChangePercent === null
                      ? 'no baseline'
                      : `${stats.periodChangePercent >= 0 ? '+' : ''}${stats.periodChangePercent.toFixed(1)}%`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-cream/40">Needs 2 snapshots</span>
              )}
            </div>
          </div>

          <div className="bg-cream/5 rounded-lg p-3 border border-cream/10">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-cream/60">Avg Monthly Growth</span>
            </div>
            <p className="text-lg font-bold text-cream mt-1">
              {stats ? formatCurrency(stats.avgMonthlyGrowth) : '—'}
            </p>
            <span className="text-xs text-cream/60">per month</span>
          </div>

          <div className="bg-cream/5 rounded-lg p-3 border border-cream/10">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-cream/60">Best Month</span>
            </div>
            <p className="text-lg font-bold text-cream mt-1">
              {stats ? formatCurrency(stats.bestMonth) : '—'}
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
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis
                      dataKey="month"
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => formatCompact(value)}
                    />
                    <Tooltip content={tooltip} />
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
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis
                      dataKey="month"
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => formatCompact(value)}
                    />
                    <Tooltip content={tooltip} />
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
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis
                      dataKey="month"
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => formatCompact(value)}
                    />
                    <Tooltip content={tooltip} />
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
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5F5DC20" />
                    <XAxis
                      dataKey="month"
                      stroke="#F5F5DC60"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="#F5F5DC60"
                      fontSize={12}
                      tickFormatter={(value) => formatCompact(value)}
                    />
                    <Tooltip content={tooltip} />
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
        {stats ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
              <h4 className="font-medium text-cream mb-2">Growth Trend</h4>
              <p className="text-sm text-cream/60">
                {stats.periodChange >= 0 ? 'Your net worth has grown' : 'Your net worth has declined'} by{' '}
                <span className={stats.periodChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(Math.abs(stats.periodChange))}
                </span>{' '}
                between {stats.rangeLabel}.
              </p>
            </div>

            <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
              <h4 className="font-medium text-cream mb-2">Asset Growth</h4>
              <p className="text-sm text-cream/60">
                {stats.assetChangePercent === null ? (
                  'Your earliest snapshot recorded no assets, so there is no baseline to compare against yet.'
                ) : (
                  <>
                    Your assets have{' '}
                    {stats.assetChangePercent > 0
                      ? 'increased'
                      : stats.assetChangePercent < 0
                        ? 'decreased'
                        : 'stayed flat'}{' '}
                    over this period, showing{' '}
                    <span className="text-blue-400">
                      {stats.assetChangePercent >= 0 ? '+' : ''}
                      {stats.assetChangePercent.toFixed(1)}%
                    </span>{' '}
                    change.
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-cream/50 text-center">
            One snapshot recorded so far. Trends appear once there are at least two.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
