"use client"

import React, { useState } from "react"
import { auth } from "../../../lib/firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { useAnalyticsData } from "../../../hooks/use-analytics-data"
import { useUpcomingBills } from "../../../hooks/use-upcoming-bills"
import { MotionDiv, MotionMain, MotionHeader } from "../../../components/ui/dynamic-motion"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
// Lazy load heavy chart components for better performance
import { 
  LazyMonthlyTrendsChart, 
  LazyCategoryComparisonChart, 
  LazySpendingHeatmap,
  LazyWrapper 
} from "../../../components/ui/lazy-components"
import { IntersectionLazy } from "../../../components/ui/intersection-lazy"
import { ChartErrorBoundary } from "../../../components/ui/error-boundary"
import { BudgetProgressCard } from "../../../components/dashboard/budget-progress-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"

// Properly typed Select components
const TypedSelectTrigger = SelectTrigger
const TypedSelectContent = SelectContent
const TypedSelectItem = SelectItem
import { LoadingSpinner } from "../../../components/ui/loading-spinner"




export default function AnalyticsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [user] = useAuthState(auth)
  const [timeframe, setTimeframe] = useState<"3months" | "6months" | "12months">("6months")
  
  const { data: analyticsData, isLoading: loading, error } = useAnalyticsData({ timeframe })
  const { data: billsData, isLoading: billsLoading } = useUpcomingBills()
  
  const monthlyData = analyticsData?.monthlyData ?? []
  const categoryData = analyticsData?.categoryData ?? []
  const summary = analyticsData?.summary ?? {
    totalExpense: 0,
    monthlyAverage: 0,
    totalTransactions: 0,
    highestCategory: 'N/A',
    highestCategoryAmount: 0
  }

  // Handle errors from the analytics data hook
  React.useEffect(() => {
    if (error) {
      console.error('Analytics data error:', error)
    }
  }, [error])

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <MotionHeader
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-medium font-outfit">Analytics</h1>
              <p className="text-cream/60 text-sm mt-1 font-outfit">Detailed insights into your spending patterns</p>
            </div>
            <div>
              <Select value={timeframe} onValueChange={(value) => setTimeframe(value as "3months" | "6months" | "12months")}>
                <TypedSelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20 w-full md:w-48">
                  <SelectValue placeholder="Select timeframe" />
                </TypedSelectTrigger>
                <TypedSelectContent className="bg-dark border-cream/10">
                  <TypedSelectItem value="3months" className="text-cream hover:bg-cream/10">
                    3 Months
                  </TypedSelectItem>
                  <TypedSelectItem value="6months" className="text-cream hover:bg-cream/10">
                    6 Months
                  </TypedSelectItem>
                  <TypedSelectItem value="12months" className="text-cream hover:bg-cream/10">
                    12 Months
                  </TypedSelectItem>
                </TypedSelectContent>
              </Select>
            </div>
          </MotionHeader>

          {/* Top Summary Cards - Clean design matching app aesthetic */}
          <MotionDiv
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Total Spending Card */}
            <MotionDiv
              className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="space-y-2">
                <p className="text-cream/60 text-sm font-outfit">Total Spending</p>
                <p className="text-3xl font-medium text-cream font-outfit">
                  {loading ? "..." : `$${summary.totalExpense.toFixed(2)}`}
                </p>
                <p className="text-cream/50 text-xs">
                  {loading ? "" : `${summary.totalTransactions} transactions`}
                </p>
              </div>
            </MotionDiv>

            {/* Monthly Average Card */}
            <MotionDiv
              className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="space-y-2">
                <p className="text-cream/60 text-sm font-outfit">Monthly Average</p>
                <p className="text-3xl font-medium text-cream font-outfit">
                  {loading ? "..." : `$${summary.monthlyAverage.toFixed(2)}`}
                </p>
                <p className="text-cream/50 text-xs">
                  {loading ? "" : `${timeframe.replace('months', '')} month period`}
                </p>
              </div>
            </MotionDiv>

            {/* Upcoming Bills Card */}
            <MotionDiv
              className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="space-y-2">
                <p className="text-cream/60 text-sm font-outfit">Upcoming Bills</p>
                <p className="text-3xl font-medium text-cream font-outfit">
                  {billsLoading ? "..." : `$${(billsData?.totalUpcoming ?? 0).toFixed(2)}`}
                </p>
                <p className={`text-xs ${
                  billsData?.overdueCount && billsData.overdueCount > 0 
                    ? 'text-red-400' 
                    : 'text-cream/50'
                }`}>
                  {billsLoading ? "" : (
                    billsData?.overdueCount && billsData.overdueCount > 0 
                      ? `${billsData.overdueCount} overdue`
                      : `${billsData?.thisWeekCount ?? 0} due this week`
                  )}
                </p>
              </div>
            </MotionDiv>
          </MotionDiv>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <MotionDiv 
                  key={i} 
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 h-[400px] flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                >
                  <LoadingSpinner variant="pulse" size="md" />
                </MotionDiv>
              ))}
            </div>
          ) : (
            <MotionDiv variants={container} initial="hidden" animate="show" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Monthly Spending Trends</h2>
                  </div>
                  <ChartErrorBoundary>
                    <LazyWrapper>
                      <IntersectionLazy>
                        <LazyMonthlyTrendsChart data={monthlyData} />
                      </IntersectionLazy>
                    </LazyWrapper>
                  </ChartErrorBoundary>
                </MotionDiv>

                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Spending by Category</h2>
                  </div>
                  <ChartErrorBoundary>
                    <LazyWrapper>
                      <IntersectionLazy>
                        <LazyCategoryComparisonChart data={categoryData} />
                      </IntersectionLazy>
                    </LazyWrapper>
                  </ChartErrorBoundary>
                </MotionDiv>

                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Spending Heatmap</h2>
                  </div>
                  <ChartErrorBoundary>
                    <LazyWrapper>
                      <IntersectionLazy>
                        <LazySpendingHeatmap />
                      </IntersectionLazy>
                    </LazyWrapper>
                  </ChartErrorBoundary>
                </MotionDiv>

                <MotionDiv
                  variants={item}
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium font-outfit">Budget Progress</h2>
                  </div>
                  <BudgetProgressCard />
                </MotionDiv>
              </div>

              <MotionDiv
                variants={item}
                className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8 hover:border-cream/20 transition-colors duration-300"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Spending Insights</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <MotionDiv
                    className="bg-cream/10 rounded-lg p-4 hover:bg-cream/15 transition-colors duration-300"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2">Highest Spending Month</h3>
                    <p className="text-2xl font-medium">
                      {monthlyData.length > 0
                        ? monthlyData.reduce((prev, current) => (current.amount > prev.amount ? current : prev)).month
                        : "N/A"}
                    </p>
                    <p className="text-cream/60 text-sm">
                      $
                      {monthlyData.length > 0
                        ? monthlyData
                            .reduce((prev, current) => (current.amount > prev.amount ? current : prev))
                            .amount.toFixed(2)
                        : "0.00"}
                    </p>
                  </MotionDiv>
                  <MotionDiv
                    className="bg-cream/10 rounded-lg p-4 hover:bg-cream/15 transition-colors duration-300"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2">Top Spending Category</h3>
                    <p className="text-2xl font-medium">{categoryData.length > 0 ? categoryData[0].category : "N/A"}</p>
                    <p className="text-cream/60 text-sm">
                      ${categoryData.length > 0 ? categoryData[0].amount.toFixed(2) : "0.00"}
                    </p>
                  </MotionDiv>
                  <MotionDiv
                    className="bg-cream/10 rounded-lg p-4 hover:bg-cream/15 transition-colors duration-300"
                    whileHover={{ y: -5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2">Average Monthly Spend</h3>
                    <p className="text-2xl font-medium">
                      $
                      {monthlyData.length > 0
                        ? (monthlyData.reduce((sum, item) => sum + item.amount, 0) / monthlyData.length).toFixed(2)
                        : "0.00"}
                    </p>
                    <p className="text-cream/60 text-sm">Over {monthlyData.length} months</p>
                  </MotionDiv>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </div>
      </main>
    </div>
  )
}

