"use client"

import type React from "react"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { CreditCard, ChevronRight, Calendar, Search, TrendingUp, Plus } from "@/lib/icons"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import dynamic from "next/dynamic"
import Image from "next/image"
// Lazy load heavy chart components with optimized loading states and progressive loading
const ExpenseChart = dynamic(() => import("@/components/dashboard/expense-chart").then(mod => ({ default: mod.ExpenseChart })), {
  ssr: false,
  loading: () => <div className="h-80 bg-cream/5 rounded-lg animate-pulse flex items-center justify-center"><div className="text-cream/60">Loading chart...</div></div>
})
const CategoryBreakdown = dynamic(() => import("@/components/dashboard/category-breakdown").then(mod => ({ default: mod.CategoryBreakdown })), {
  ssr: false,
  loading: () => <div className="h-64 bg-cream/5 rounded-lg animate-pulse flex items-center justify-center"><div className="text-cream/60">Loading breakdown...</div></div>
})
const AdvancedAnalytics = dynamic(() => import("@/components/dashboard/advanced-analytics").then(mod => ({ default: mod.AdvancedAnalytics })), {
  ssr: false,
  loading: () => <div className="h-40 bg-cream/5 rounded-lg animate-pulse flex items-center justify-center"><div className="text-cream/60">Loading analytics...</div></div>
})
const StockMarket = dynamic(() => import("@/components/dashboard/stock-market").then(mod => ({ default: mod.StockMarket })), {
  ssr: false,
  loading: () => <div className="h-96 bg-cream/5 rounded-lg animate-pulse flex items-center justify-center"><div className="text-cream/60">Loading market data...</div></div>
})

// Lazy load motion container to reduce initial bundle
const MotionContainer = dynamic(() => import("@/components/ui/motion-container").then(mod => mod.MotionContainer), {
  ssr: false,
  loading: () => <div />
})

// Import lightweight components normally
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { MetricCard } from "@/components/dashboard/metric-card"
import { SavingsGoals } from "@/components/dashboard/savings-goals"
import { BillReminders } from "@/components/dashboard/bill-reminders"
import { ResponsiveLayoutContainer } from "@/components/dashboard/responsive-layout-container"
import { usePortfolioState } from "@/hooks/use-portfolio-state"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useUpcomingBills } from "@/hooks/use-upcoming-bills"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown"
import { api } from "@/lib/api"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import type { NetWorthCalculation, Budget } from "@/lib/types"

interface Expense {
  id: string
  name: string
  amount: number
  date: string
  category: string
  description?: string
  userId: string
}

interface Notification {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  userId: string
  createdAt: string
}

interface DashboardPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function DashboardPage(props: DashboardPageProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])
  const router = useRouter()
  const portfolioState = usePortfolioState()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Expense[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [timeframe, setTimeframe] = useState("30days")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthCalculation | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Get upcoming bills data
  const { data: billsData } = useUpcomingBills()

  // Helper function to safely parse expense dates
  const parseExpenseDate = useCallback((dateValue: any): Date => {
    if (!dateValue) return new Date()
    
    try {
      // If it's already a Date object
      if (dateValue instanceof Date) return dateValue
      
      // If it's a Firebase Timestamp
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        return dateValue.toDate()
      }
      
      // If it's a string or number, parse it
      const parsed = new Date(dateValue)
      return isNaN(parsed.getTime()) ? new Date() : parsed
    } catch {
      return new Date()
    }
  }, [])

  // Calculate real metrics from user expense data
  const metrics = useMemo(() => {
    if (!expenses.length) {
      return {
        totalExpenses: 0,
        monthlyAverage: 0,
        monthlyChange: 0,
        averageChange: 0
      }
    }

    // Calculate total expenses for current period
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Current month expenses
    const currentMonthExpenses = expenses.filter(expense => {
      const expenseDate = parseExpenseDate(expense.date)
      return expenseDate >= startOfMonth
    })

    // Last month expenses 
    const lastMonthExpenses = expenses.filter(expense => {
      const expenseDate = parseExpenseDate(expense.date)
      return expenseDate >= startOfLastMonth && expenseDate <= endOfLastMonth
    })

    // Last 6 months for average calculation
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const recentExpenses = expenses.filter(expense => {
      const expenseDate = parseExpenseDate(expense.date)
      return expenseDate >= sixMonthsAgo
    })

    const totalExpenses = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const lastMonthTotal = lastMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    const monthlyChange = lastMonthTotal > 0 ? ((totalExpenses - lastMonthTotal) / lastMonthTotal) * 100 : 0

    // Calculate monthly average from recent expenses
    const monthlyAverage = recentExpenses.length > 0 ? recentExpenses.reduce((sum, expense) => sum + expense.amount, 0) / 6 : 0
    
    // Previous 6 months for comparison
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)
    const olderExpenses = expenses.filter(expense => {
      const expenseDate = parseExpenseDate(expense.date)
      return expenseDate >= twelveMonthsAgo && expenseDate < sixMonthsAgo
    })
    
    const olderAverage = olderExpenses.length > 0 ? olderExpenses.reduce((sum, expense) => sum + expense.amount, 0) / 6 : 0
    const averageChange = olderAverage > 0 ? ((monthlyAverage - olderAverage) / olderAverage) * 100 : 0

    return {
      totalExpenses,
      monthlyAverage,
      monthlyChange,
      averageChange
    }
  }, [expenses, parseExpenseDate])

  // Fix hydration issues by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  type DashboardPayload = { expenses: Expense[]; budgets: Budget[]; notifications: Notification[] }

  // Dashboard payload through React Query so staleTime/invalidation apply -
  // the previous getQueryData early-return meant the numbers never refreshed
  // within a session.
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', user?.uid],
    enabled: !!user && mounted,
    queryFn: async (): Promise<DashboardPayload> => {
      const token = await userRef.current?.getIdToken()
      const response = await api.get<DashboardPayload | { success?: boolean; data?: DashboardPayload }>(
        'dashboard',
        { token }
      )
      // Backend wraps the payload in { success, data }
      return ('data' in response && response.data ? response.data : response) as DashboardPayload
    },
  })

  const netWorthQuery = useQuery({
    queryKey: ['net-worth', user?.uid],
    enabled: !!user && mounted,
    queryFn: async (): Promise<NetWorthCalculation | null> => {
      const token = await userRef.current?.getIdToken()
      const data = await api.get<{ data: NetWorthCalculation }>('net-worth/calculate', { token })
      return data.data ?? null
    },
  })

  useEffect(() => {
    // Note: the dashboard payload is capped server-side (recent items only),
    // so it must not be used to prime the full expenses cache.
    setExpenses(dashboardQuery.data?.expenses || [])
    setBudgets(dashboardQuery.data?.budgets || [])
    setNotifications(dashboardQuery.data?.notifications || [])
  }, [dashboardQuery.data])

  useEffect(() => {
    setNetWorth(netWorthQuery.data ?? null)
  }, [netWorthQuery.data])

  const searchExpenses = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setShowSearchResults(true)
    // Use requestIdleCallback for search to prevent blocking main thread
    const performSearch = () => {
      const term = searchTerm.toLowerCase()
      const filtered = expenses
        .slice(0, 30) // Further reduced for better performance
        .filter(expense => {
          // Optimized search with early returns
          const name = expense.name || ''
          const category = expense.category || ''
          const description = expense.description || ''

          return name.toLowerCase().includes(term) ||
                 category.toLowerCase().includes(term) ||
                 description.toLowerCase().includes(term)
        })
      setSearchResults(filtered)
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(performSearch, { timeout: 100 })
    } else {
      performSearch()
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchExpenses(searchQuery)
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    if (value.trim()) {
      searchExpenses(value)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }





  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Helper function to format percentage
  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!mounted) {
    return (
      <div className="flex h-screen bg-dark text-cream overflow-hidden">
        <div className="h-screen bg-dark border-r border-cream/10 flex flex-col" style={{ width: "80px" }}>
          {/* Skeleton sidebar */}
          <div className="p-4">
            <div className="h-8 w-8 bg-cream/5 rounded-lg mb-8" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-cream/5 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {/* Header skeleton */}
            <div className="flex items-center justify-between mb-8">
              <div className="h-8 w-48 bg-cream/5 rounded-md" />
              <div className="h-10 w-32 bg-cream/5 rounded-full" />
            </div>

            {/* Metrics cards skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-cream/5 rounded-xl p-4">
                  <div className="h-4 w-24 bg-cream/10 rounded mb-2" />
                  <div className="h-6 w-16 bg-cream/10 rounded mb-1" />
                  <div className="h-3 w-20 bg-cream/10 rounded" />
                </div>
              ))}
            </div>

            {/* Charts skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
              <div className="h-80 bg-cream/5 rounded-xl" />
              <div className="h-80 bg-cream/5 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
        <div className="w-full">
          <header className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center ml-12 md:ml-0">
                <Link href="/" className="hidden md:flex items-center hover:opacity-80 transition-opacity mr-3">
                  <Image src="/sokin-icon.png" alt="Sokin" width={40} height={40} className="h-10 w-10" priority />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-medium font-outfit">Dashboard</h1>
                  <p className="text-cream/60 text-sm mt-1 font-outfit">
                    Welcome back, {user?.displayName?.split(" ")[0] || "User"}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push("/dashboard/add-expense")}
                aria-label="Add expense"
                className="md:hidden flex items-center justify-center h-10 w-10 p-0 rounded-lg bg-cream text-dark font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:bg-cream/90"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <form onSubmit={handleSearch} className="relative flex-1 sm:w-64 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/40" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  className="pl-10 bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                />
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-dark border border-cream/10 rounded-md shadow-lg z-50">
                    <div className="p-2 border-b border-cream/10 flex justify-between items-center">
                      <span className="text-sm font-medium">Search Results</span>
                      <button
                        type="button"
                        onClick={() => setShowSearchResults(false)}
                        className="text-cream/60 hover:text-cream text-xs"
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          className="p-2 hover:bg-cream/5 cursor-pointer"
                          onClick={() => router.push(`/dashboard/expenses?search=${encodeURIComponent(result.name || '')}`)}
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{result.name}</span>
                            <span>${result.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-cream/60">
                            <span>{result.category}</span>
                            <span>
                              {(() => {
                                const date = parseExpenseDate(result.date)
                                return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString()
                              })()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>

              <div className="flex items-center gap-3">
                <NotificationsDropdown />
                <button
                  onClick={() => router.push("/dashboard/add-expense")}
                  className="hidden md:flex items-center justify-center h-11 px-5 rounded-lg bg-cream text-dark font-medium text-sm tracking-wide transition-all duration-200 shadow-sm hover:shadow-md hover:bg-cream/90 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="uppercase">Add Expense</span>
                </button>
              </div>
            </div>
          </header>

          {/* Row 1: 4 Equal Metric Cards - Real User Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <MotionContainer delay={0.1}>
              <MetricCard
                title="Total Expenses"
                value={formatCurrency(metrics.totalExpenses)}
                change={formatPercent(metrics.monthlyChange)}
                trend={
                  metrics.monthlyChange === 0 ? "neutral" :
                  metrics.monthlyChange > 0 ? "up" : "down"
                }
                period="vs last month"
                icon={<CreditCard className="h-5 w-5" />}
              />
            </MotionContainer>
            <MotionContainer delay={0.2}>
              <MetricCard
                title="Monthly Average"
                value={formatCurrency(metrics.monthlyAverage)}
                change={formatPercent(metrics.averageChange)}
                trend={
                  metrics.averageChange === 0 ? "neutral" :
                  metrics.averageChange > 0 ? "up" : "down"
                }
                period="vs last 6 months"
                icon={<Calendar className="h-5 w-5" />}
              />
            </MotionContainer>
            <MotionContainer delay={0.3}>
              <Link href="/dashboard/net-worth" className="block">
                <MetricCard
                  title="Net Worth"
                  polarity="growth"
                  value={netWorth ? formatCurrency(netWorth.netWorth) : "$0.00"}
                  change={netWorth?.monthlyChangePercent ? formatPercent(netWorth.monthlyChangePercent) : "0.0%"}
                  trend={
                    !netWorth?.monthlyChange || netWorth.monthlyChange === 0 ? "neutral" :
                    netWorth.monthlyChange > 0 ? "up" : "down"
                  }
                  period="vs last month"
                  icon={<TrendingUp className="h-5 w-5" />}
                />
              </Link>
            </MotionContainer>
            <MotionContainer delay={0.4}>
              <MetricCard
                title="Upcoming Bills"
                value={billsData ? formatCurrency(billsData.totalUpcoming) : "$0.00"}
                secondaryValue={billsData ? `${billsData.upcomingBills.length} bills due` : "No bills"}
                icon={<Calendar className="h-5 w-5" />}
              />
            </MotionContainer>
          </div>

          {/* Row 2: 2 Containers - Spending Trends (Large), Category Breakdown (Medium) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
            {/* Spending Trends - Large (6 columns on lg+, full width on md) */}
            <div className="md:col-span-2 lg:col-span-6">
              <MotionContainer className="bg-cream/5 rounded-xl p-4 lg:p-6 h-full min-h-[420px]" delay={0.5}>
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                  <h2 className="text-lg lg:text-xl font-medium font-outfit">Spending Trends</h2>
                  <Select value={timeframe} onValueChange={setTimeframe}>
                    <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20 w-full md:w-48">
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark border-cream/10">
                      <SelectItem value="30days" className="text-cream hover:bg-cream/10">
                        Last 30 Days
                      </SelectItem>
                      <SelectItem value="90days" className="text-cream hover:bg-cream/10">
                        Last 90 Days
                      </SelectItem>
                      <SelectItem value="year" className="text-cream hover:bg-cream/10">
                        This Year
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-80 lg:h-96">
                  <ExpenseChart timeframe={timeframe} />
                </div>
              </MotionContainer>
            </div>

            {/* Category Breakdown - Medium (6 columns on lg+, half width on md) */}
            <div className="md:col-span-1 lg:col-span-6">
              <MotionContainer className="bg-cream/5 rounded-xl p-4 lg:p-6 h-full min-h-[420px]" delay={0.6}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 lg:mb-6">
                  <h2 className="text-base lg:text-lg font-medium font-outfit">Spending by Category</h2>
                  <button 
                    className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group self-start sm:self-auto"
                    onClick={() => router.push("/dashboard/analytics")}
                  >
                    View All
                    <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                </div>
                <CategoryBreakdown />
              </MotionContainer>
            </div>
          </div>

          {/* Responsive Layout Container - Adapts based on portfolio state */}
          <ResponsiveLayoutContainer
            portfolioState={portfolioState}
            billsSection={
              <MotionContainer className="bg-cream/5 rounded-xl p-4 lg:p-6 h-full" delay={0.7}>
                <div className="flex flex-col gap-2 mb-4">
                  <h2 className="text-base lg:text-lg font-medium font-outfit">Bills</h2>
                  <button
                    onClick={() => router.push("/dashboard/bills")}
                    className="text-cream/60 text-xs hover:text-cream transition-colors flex items-center group self-start"
                  >
                    View All
                    <ChevronRight className="h-3 w-3 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                </div>
                <BillReminders />
              </MotionContainer>
            }
            stockMarketSection={
              <MotionContainer className="bg-cream/5 rounded-xl p-4 lg:p-6 flex flex-col h-full" delay={0.8}>
                <div className="flex items-center justify-between mb-4 lg:mb-6 flex-shrink-0">
                  <h2 className="text-lg lg:text-xl font-medium font-outfit">Stock Market</h2>
                  <button
                    onClick={() => router.push("/dashboard/stocks")}
                    className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                  >
                    View All Stocks
                    <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                </div>
                <div className="flex-1 min-h-[800px] overflow-auto scrollbar-hide">
                  <StockMarket compact={true} />
                </div>
              </MotionContainer>
            }
            savingsAnalyticsSection={
              <div className="space-y-4 lg:space-y-6 h-full flex flex-col">
                {/* Savings Goals */}
                <MotionContainer className="bg-cream/5 rounded-xl p-4 lg:p-6 flex-1 flex flex-col" delay={0.9}>
                  <div className="flex items-center justify-between mb-4 lg:mb-6">
                    <h2 className="text-lg lg:text-xl font-medium font-outfit">Savings Goals</h2>
                    <button
                      onClick={() => router.push("/dashboard/goals")}
                      className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                    >
                      Manage
                      <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <SavingsGoals hideHeader />
                  </div>
                </MotionContainer>

                {/* Advanced Analytics with integrated Monthly Category Breakdown */}
                <MotionContainer className="bg-cream/5 rounded-xl p-4 lg:p-6 flex-1 flex flex-col" delay={1.0}>
                  <div className="flex items-center justify-between mb-4 lg:mb-6">
                    <h2 className="text-lg lg:text-xl font-medium font-outfit">Analytics Overview</h2>
                    <button
                      onClick={() => router.push("/dashboard/analytics")}
                      className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                    >
                      View Details
                      <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <AdvancedAnalytics budgets={budgets} timeframe={timeframe} />
                  </div>
                </MotionContainer>
              </div>
            }
            recentTransactionsSection={
              <MotionContainer className="bg-cream/5 rounded-xl p-4 lg:p-6 flex flex-col h-full" delay={1.1}>
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                  <h2 className="text-lg lg:text-xl font-medium font-outfit">Recent Transactions</h2>
                  <button
                    onClick={() => router.push("/dashboard/expenses")}
                    className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                  >
                    View All
                    <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <RecentTransactions expenses={expenses.slice(0, 7)} />
                </div>
              </MotionContainer>
            }
          />




        </div>
      </main>
    </div>
  )
}
