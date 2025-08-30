"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { PieChart, PlusCircle, CreditCard, ChevronRight, Calendar, Search, TrendingUp } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import dynamic from "next/dynamic"
import Image from "next/image"
// Lazy load heavy chart components with loading states
const ExpenseChart = dynamic(() => import("../../components/dashboard/expense-chart").then(mod => ({ default: mod.ExpenseChart })), {
  ssr: false,
  loading: () => <div className="h-80 bg-cream/5 rounded-lg animate-pulse" />
})
const CategoryBreakdown = dynamic(() => import("../../components/dashboard/category-breakdown").then(mod => ({ default: mod.CategoryBreakdown })), {
  ssr: false,
  loading: () => <div className="h-64 bg-cream/5 rounded-lg animate-pulse" />
})
const AdvancedAnalytics = dynamic(() => import("../../components/dashboard/advanced-analytics").then(mod => ({ default: mod.AdvancedAnalytics })), {
  ssr: false,
  loading: () => <div className="h-40 bg-cream/5 rounded-lg animate-pulse" />
})
const StockMarket = dynamic(() => import("../../components/dashboard/stock-market").then(mod => ({ default: mod.StockMarket })), {
  ssr: false,
  loading: () => <div className="h-96 bg-cream/5 rounded-lg animate-pulse" />
})

// Import lightweight components normally
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { MetricCard } from "@/components/dashboard/metric-card"
import { SavingsGoals } from "@/components/dashboard/savings-goals"
import { BillReminders } from "@/components/dashboard/bill-reminders"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
// Lazy load motion container to reduce initial bundle
const MotionContainer = dynamic(() => import("../../components/ui/motion-container").then(mod => ({ default: mod.MotionContainer })), {
  ssr: false,
  loading: () => <div />
})
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown"
import { api } from "@/lib/api"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
const StackedBarChart = dynamic(() => import("../../components/dashboard/stacked-bar-chart").then(mod => ({ default: mod.StackedBarChart })), {
  ssr: false,
  loading: () => <div className="h-64 bg-cream/5 rounded-lg animate-pulse" />
})
import type { NetWorthCalculation } from "@/lib/types"

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

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Expense[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [timeframe, setTimeframe] = useState("30days")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthCalculation | null>(null)

  // Fix hydration issues by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch dashboard data when user is available
  useEffect(() => {
    if (user && mounted) {
      fetchDashboard()
      fetchNetWorth()
    }
  }, [user, mounted])

  // Check for unread notifications
  useEffect(() => {
    const unreadExists = notifications.some((notification) => !notification.read)
    setHasUnreadNotifications(unreadExists)
  }, [notifications])

  const fetchDashboard = async () => {
    if (!user) return
    
    // Check if we already have cached data
    const cachedData = queryClient.getQueryData(['dashboard', user.uid])
    if (cachedData) {
      const data = cachedData as { expenses: Expense[]; budgets: any[]; notifications: Notification[] }
      setExpenses(data.expenses || [])
      setBudgets(data.budgets || [])
      setNotifications(data.notifications || [])
      return
    }
    
    try {
      const token = await user.getIdToken()
      const data = await api.get<{ expenses: Expense[]; budgets: any[]; notifications: Notification[] }>(
        'dashboard',
        { token }
      )
      setExpenses(data.expenses || [])
      setBudgets(data.budgets || [])
      setNotifications(data.notifications || [])

      // Cache dashboard data
      queryClient.setQueryData(['dashboard', user.uid], data, {
        updatedAt: Date.now(),
      })
      
      // Prime React Query cache for shared expenses hook consumers
      queryClient.setQueryData(['expenses', user.uid, null], data.expenses || [])
    } catch (error) {
      setExpenses([])
      setBudgets([])
      setNotifications([])
    }
  }

  const fetchNetWorth = async () => {
    try {
      const token = await user?.getIdToken()
      const data = await api.get('net-worth/calculate', { token })
      setNetWorth(data.data)
    } catch (error) {

    }
  }

  const searchExpenses = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setShowSearchResults(true)
    // Filter locally from loaded expenses with improved performance
    const filtered = expenses
      .slice(0, 50) // Reduced from 200 to 50 for better performance
      .filter(expense => {
        const term = searchTerm.toLowerCase()
        return (
          (expense.name || '').toLowerCase().includes(term) ||
          (expense.category || '').toLowerCase().includes(term) ||
          (expense.description || '').toLowerCase().includes(term)
        )
      })
    setSearchResults(filtered)
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

  const markAllAsRead = async () => {
    // This would update notifications in Firebase
    // For now, just update local state
    setNotifications(notifications.map((notification) => ({ ...notification, read: true })))
    setHasUnreadNotifications(false)
  }

  const markAsRead = async (id: string) => {
    // This would update specific notification in Firebase
    // For now, just update local state
    setNotifications(
      notifications.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    )
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
        <div className="h-screen bg-dark border-r border-cream/10 flex flex-col" style={{ width: "80px" }} />
        <div className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="h-12 w-64 bg-cream/5 rounded-md animate-pulse mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-cream/5 rounded-xl animate-pulse" />
              ))}
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
                className="md:hidden flex items-center justify-center h-10 w-10 rounded-full bg-cream text-dark font-medium text-sm transition-all hover:bg-cream/90"
              >
                <PlusCircle className="h-5 w-5" />
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
                            <span>{new Date(result.date).toLocaleDateString()}</span>
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
                  className="hidden md:flex items-center justify-center h-10 px-4 rounded-full bg-cream text-dark font-medium text-sm transition-all hover:bg-cream/90 group"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Expense
                </button>
              </div>
            </div>
          </header>

          {/* Row 1: 4 Equal Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <MotionContainer delay={0.1}>
              <MetricCard
                title="Total Expenses"
                value="$4,250.00"
                change="+12.5%"
                trend="up"
                period="vs last month"
                icon={<CreditCard className="h-5 w-5" />}
              />
            </MotionContainer>
            <MotionContainer delay={0.2}>
              <MetricCard
                title="Monthly Average"
                value="$1,840.00"
                change="-3.2%"
                trend="down"
                period="vs last month"
                icon={<Calendar className="h-5 w-5" />}
              />
            </MotionContainer>
            <MotionContainer delay={0.3}>
              <Link href="/dashboard/net-worth" className="block">
                <MetricCard
                  title="Net Worth"
                  value={netWorth ? formatCurrency(netWorth.netWorth) : "$0.00"}
                  change={netWorth?.monthlyChangePercent ? formatPercent(netWorth.monthlyChangePercent) : "0.0%"}
                  trend={netWorth?.monthlyChange ? (netWorth.monthlyChange >= 0 ? "up" : "down") : "up"}
                  period="vs last month"
                  icon={<TrendingUp className="h-5 w-5" />}
                />
              </Link>
            </MotionContainer>
            <MotionContainer delay={0.4}>
              <MetricCard
                title="Upcoming Bills"
                value="$1,250.00"
                secondaryValue="3 bills due"
                icon={<Calendar className="h-5 w-5" />}
              />
            </MotionContainer>
          </div>

          {/* Row 2: 3 Containers - Spending Trends (Large), Category Breakdown (Medium), Bill Reminders (Small) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
            {/* Spending Trends - Large (6 columns on lg+, full width on md) */}
            <div className="md:col-span-2 lg:col-span-6">
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 h-full min-h-[420px]" delay={0.5}>
                <div className="flex items-center justify-between mb-4 lg:mb-6">
                  <h2 className="text-lg lg:text-xl font-medium font-outfit">Spending Trends</h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center text-cream/60 text-sm hover:text-cream bg-cream/5 px-3 py-1.5 rounded-md border border-cream/10">
                      {timeframe === "30days" ? "Last 30 Days" : timeframe === "90days" ? "Last 90 Days" : "This Year"}
                      <ChevronRight className="h-4 w-4 ml-2 transform rotate-90" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-dark border-cream/10">
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setTimeframe("30days")}
                      >
                        Last 30 Days
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setTimeframe("90days")}
                      >
                        Last 90 Days
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setTimeframe("year")}
                      >
                        This Year
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="h-80 lg:h-96">
                  <ExpenseChart timeframe={timeframe} />
                </div>
              </MotionContainer>
            </div>

            {/* Category Breakdown - Medium (4 columns on lg+, half width on md) */}
            <div className="md:col-span-1 lg:col-span-4">
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 h-full min-h-[320px]" delay={0.6}>
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

            {/* Bill Reminders - Small (2 columns on lg+, half width on md) */}
            <div className="md:col-span-1 lg:col-span-2">
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 h-full min-h-[280px]" delay={0.7}>
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
            </div>
          </div>

          {/* Row 3: 2 Containers - Stock Market (Left), Savings & Analytics (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
            {/* Stock Market - Left Half */}
            <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 min-h-[400px]" delay={0.8}>
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <h2 className="text-lg lg:text-xl font-medium font-outfit">Stock Market</h2>
                <button
                  onClick={() => router.push("/dashboard/stocks")}
                  className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                >
                  View All Stocks
                  <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </div>
              <StockMarket />
            </MotionContainer>

            {/* Combined Savings Goals & Analytics - Right Half */}
            <div className="space-y-4 lg:space-y-6">
              {/* Savings Goals */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 min-h-[180px]" delay={0.9}>
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
                <SavingsGoals />
              </MotionContainer>

              {/* Advanced Analytics */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 min-h-[180px]" delay={1.0}>
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
                <AdvancedAnalytics budgets={budgets} timeframe={timeframe} />
              </MotionContainer>
            </div>
          </div>

          {/* Bottom Row: Recent Transactions and Monthly Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
            {/* Recent Transactions - Left */}
            <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 min-h-[350px] flex flex-col" delay={1.1}>
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
                <RecentTransactions />
              </div>
            </MotionContainer>

            {/* Monthly Category Breakdown - Right */}
            <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 lg:p-6 min-h-[350px]" delay={1.2}>
              <div className="flex items-center justify-between mb-4 lg:mb-6">
                <h2 className="text-lg lg:text-xl font-medium font-outfit">Monthly Category Breakdown</h2>
                <span className="text-xs bg-cream/10 text-cream/80 px-2 py-1 rounded-full">Last 6 Months</span>
              </div>
              <div className="flex-1 min-h-0">
                <StackedBarChart timeframe={timeframe} />
              </div>
            </MotionContainer>
          </div>




        </div>
      </main>
    </div>
  )
}

