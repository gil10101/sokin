"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { PieChart, PlusCircle, CreditCard, ChevronRight, Calendar, Search } from "lucide-react"
import { DashboardSidebar } from "../../components/dashboard/sidebar"
import { ExpenseChart } from "../../components/dashboard/expense-chart"
import { CategoryBreakdown } from "../../components/dashboard/category-breakdown"
import { RecentTransactions } from "../../components/dashboard/recent-transactions"
import { MetricCard } from "../../components/dashboard/metric-card"
import { Input } from "../../components/ui/input"
import { useAuth } from "../../contexts/auth-context"
import { useRouter } from "next/navigation"
import { MotionContainer } from "../../components/ui/motion-container"
import { LoadingSpinner } from "../../components/ui/loading-spinner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu"
import { NotificationsDropdown } from "../../components/notifications/notifications-dropdown"
import Link from "next/link"

export default function DashboardPage() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [timeframe, setTimeframe] = useState("30days")
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Budget Alert",
      message: "You've reached 80% of your Dining budget",
      time: "2 hours ago",
      read: false,
    },
    { id: 2, title: "New Feature", message: "Try our new budget planning tool", time: "1 day ago", read: false },
    { id: 3, title: "Tip", message: "Set up recurring expenses to track bills", time: "3 days ago", read: true },
  ])
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true)

  // Fix hydration issues by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check for unread notifications
  useEffect(() => {
    const unreadExists = notifications.some((notification) => !notification.read)
    setHasUnreadNotifications(unreadExists)
  }, [notifications])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setShowSearchResults(false)
      return
    }

    // Mock search results - in a real app, this would query your database
    const mockResults = [
      { id: 1, name: "Starbucks Coffee", date: "Today", amount: 5.75, category: "Dining" },
      { id: 2, name: "Amazon Purchase", date: "Yesterday", amount: 34.99, category: "Shopping" },
      { id: 3, name: "Uber Ride", date: "Mar 20", amount: 12.5, category: "Transport" },
    ].filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    setSearchResults(mockResults)
    setShowSearchResults(true)
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map((notification) => ({ ...notification, read: true })))
    setHasUnreadNotifications(false)
  }

  const markAsRead = (id: number) => {
    setNotifications(
      notifications.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)),
    )
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

      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center">
              <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
                <img src="/sokin-icon.png" alt="Sokin" className="h-10 w-10 mr-3" />
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-medium font-outfit">Dashboard</h1>
                <p className="text-cream/60 text-sm mt-1 font-outfit">
                  Welcome back, {user?.displayName?.split(" ")[0] || "User"}. Here's your financial overview.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <form onSubmit={handleSearch} className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/40" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (!e.target.value) setShowSearchResults(false)
                  }}
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
                          onClick={() => router.push(`/dashboard/expenses?search=${encodeURIComponent(result.name)}`)}
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{result.name}</span>
                            <span>${result.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-cream/60">
                            <span>{result.category}</span>
                            <span>{result.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>

              <NotificationsDropdown />

              <button
                onClick={() => router.push("/dashboard/add-expense")}
                className="hidden md:flex items-center justify-center h-10 px-4 rounded-full bg-cream text-dark font-medium text-sm transition-all hover:bg-cream/90 group"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Expense
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <MotionContainer className="lg:col-span-2 bg-cream/5 rounded-xl border border-cream/10 p-6" delay={0.5}>
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
            <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-6" delay={0.6}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium font-outfit">Spending by Category</h2>
                <button 
                  className="text-cream/60 text-sm hover:text-cream transition-colors flex items-center group"
                  onClick={() => router.push("/dashboard/analytics")}
                >
                  View All
                  <ChevronRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
                </button>
              </div>
              <CategoryBreakdown />
            </MotionContainer>
          </div>

          <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-6" delay={0.7}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium font-outfit">Recent Transactions</h2>
              <button
                onClick={() => router.push("/dashboard/analytics")}
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

