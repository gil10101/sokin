"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { PieChart, PlusCircle, CreditCard, ChevronRight, Calendar, Search } from "lucide-react"
import { DashboardSidebar } from "../../components/dashboard/sidebar"
import { ExpenseChart } from "../../components/dashboard/expense-chart"
import { CategoryBreakdown } from "../../components/dashboard/category-breakdown"
import { RecentTransactions } from "../../components/dashboard/recent-transactions"
import { MetricCard } from "../../components/dashboard/metric-card"
import { ReceiptScanner } from "../../components/dashboard/receipt-scanner"
import { SavingsGoals } from "../../components/dashboard/savings-goals"
import { AdvancedAnalytics } from "../../components/dashboard/advanced-analytics"
import { BillReminders } from "../../components/dashboard/bill-reminders"
import { StockMarket } from "../../components/dashboard/stock-market"
import { Input } from "../../components/ui/input"
import { useAuth } from "../../contexts/auth-context"
import { useRouter } from "next/navigation"
import { MotionContainer } from "../../components/ui/motion-container"
import { LoadingSpinner } from "../../components/ui/loading-spinner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu"
import { NotificationsDropdown } from "../../components/notifications/notifications-dropdown"
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import Link from "next/link"
import { StackedBarChart } from "../../components/dashboard/stacked-bar-chart"

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

  // Fix hydration issues by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch notifications when user is available
  useEffect(() => {
    if (user && mounted) {
      fetchNotifications()
    }
  }, [user, mounted])

  // Check for unread notifications
  useEffect(() => {
    const unreadExists = notifications.some((notification) => !notification.read)
    setHasUnreadNotifications(unreadExists)
  }, [notifications])

  const fetchNotifications = async () => {
    if (!user) return

    try {
      const notificationsRef = collection(db, "notifications")
      const q = query(
        notificationsRef, 
        where("userId", "==", user.uid), 
        orderBy("createdAt", "desc"),
        limit(10)
      )

      const querySnapshot = await getDocs(q)
      const notificationsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[]

      setNotifications(notificationsData)
    } catch (error) {
      console.error("Error fetching notifications:", error)
      // Fallback to empty notifications if there's an error
      setNotifications([])
    }
  }

  const searchExpenses = async (searchTerm: string) => {
    if (!user || !searchTerm.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    try {
      const expensesRef = collection(db, "expenses")
      const q = query(
        expensesRef,
        where("userId", "==", user.uid),
        orderBy("date", "desc"),
        limit(10)
      )

      const querySnapshot = await getDocs(q)
      const allExpenses = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[]

      // Filter expenses by search term (client-side filtering)
      const filteredExpenses = allExpenses.filter(
        (expense) =>
          expense.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )

      setSearchResults(filteredExpenses)
      setShowSearchResults(true)
    } catch (error) {
      console.error("Error searching expenses:", error)
      setSearchResults([])
      setShowSearchResults(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchExpenses(searchQuery)
  }

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    
    if (!value.trim()) {
      setShowSearchResults(false)
      setSearchResults([])
    } else {
      // Debounce search
      const timeoutId = setTimeout(() => {
        searchExpenses(value)
      }, 300)
      
      return () => clearTimeout(timeoutId)
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

  const handleReceiptDataExtracted = (data: any) => {
    // Handle extracted receipt data
    router.push(`/dashboard/add-expense?receiptData=${encodeURIComponent(JSON.stringify(data))}`)
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

      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="w-full">
          <header className="flex flex-col gap-4 mb-6 sm:mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center ml-12 md:ml-0">
                <Link href="/" className="hidden md:flex items-center hover:opacity-80 transition-opacity mr-3">
                  <img src="/sokin-icon.png" alt="Sokin" className="h-10 w-10" />
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

          {/* Metrics Cards - Full Width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
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
              <MetricCard
                title="Top Category"
                value="Dining"
                secondaryValue="$840.00"
                icon={<PieChart className="h-5 w-5" />}
              />
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

          {/* Main Content Area - Responsive Grid for Larger Screens */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
            {/* Left Column - Charts */}
            <div className="xl:col-span-7 space-y-4 sm:space-y-6">
              {/* Spending Trends */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={0.5}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Spending Trends</h2>
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
                <ExpenseChart timeframe={timeframe} />
              </MotionContainer>

              {/* Monthly Category Breakdown */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={0.7}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Monthly Category Breakdown</h2>
                  <span className="text-xs bg-cream/10 text-cream/80 px-2 py-1 rounded-full">Last 6 Months</span>
                </div>
                <StackedBarChart timeframe={timeframe} />
              </MotionContainer>

              {/* Stock Market Section */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={0.8}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Stock Market</h2>
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
            </div>

            {/* Right Column - Sidebar-like layout */}
            <div className="xl:col-span-5 space-y-4 sm:space-y-6">
              {/* Category Breakdown */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={0.6}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                  <h2 className="text-base sm:text-lg font-medium font-outfit">Spending by Category</h2>
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

              {/* Bill Reminders */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={0.9}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Bill Reminders</h2>
                  <button
                    onClick={() => router.push("/dashboard/bills")}
                    className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                  >
                    View All
                    <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                  </button>
                </div>
                <BillReminders />
              </MotionContainer>

              {/* Savings Goals */}
              <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={0.8}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Savings Goals</h2>
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
            </div>
          </div>



          {/* Bottom Section - Two Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
            <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={0.7}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium font-outfit">Receipt Scanner</h2>
                <span className="text-xs bg-cream/10 text-cream/80 px-2 py-1 rounded-full">Smart OCR</span>
              </div>
              <ReceiptScanner onDataExtracted={handleReceiptDataExtracted} />
            </MotionContainer>
            
            <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6" delay={1.0}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium font-outfit">Advanced Analytics</h2>
                <button
                  onClick={() => router.push("/dashboard/analytics")}
                  className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                >
                  View Details
                  <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </div>
              <AdvancedAnalytics expenses={expenses} budgets={budgets} timeframe={timeframe} />
            </MotionContainer>
          </div>

          {/* Recent Transactions - Full Width */}
          <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6 mt-6 sm:mt-8" delay={1.1}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium font-outfit">Recent Transactions</h2>
              <button
                onClick={() => router.push("/dashboard/expenses")}
                className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
              >
                View All
                <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            </div>
            <RecentTransactions />
          </MotionContainer>
        </div>
      </main>
    </div>
  )
}

