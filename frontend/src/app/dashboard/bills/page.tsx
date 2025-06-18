"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, addDays, isWithinInterval, isBefore, isAfter } from "date-fns"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { PageHeader } from "../../../components/dashboard/page-header"
import { BillReminders } from "../../../components/dashboard/bill-reminders"
import { MetricCard } from "../../../components/dashboard/metric-card"
import { Button } from "../../../components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Badge } from "../../../components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu"
import { MotionContainer } from "../../../components/ui/motion-container"
import { 
  Bell, 
  Calendar as CalendarIcon, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Plus,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ChevronRight
} from "lucide-react"
import { motion } from "framer-motion"
import { useToast } from "../../../hooks/use-toast"
import { LoadingSpinner } from "../../../components/ui/loading-spinner"

interface BillReminder {
  id?: string
  userId: string
  name: string
  amount: number
  dueDate: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'
  category: string
  description?: string
  isPaid: boolean
  paidDate?: string
  reminderDays: number[]
  autoPayEnabled: boolean
  linkedAccount?: string
  createdAt: string
  updatedAt?: string
}

interface BillStats {
  totalBills: number
  upcomingBills: number
  overdueBills: number
  monthlyTotal: number
  monthlyPaid: number
  categoryBreakdown: { category: string; amount: number; count: number }[]
}

export default function BillsPage() {
  const [bills, setBills] = useState<BillReminder[]>([])
  const [stats, setStats] = useState<BillStats>({
    totalBills: 0,
    upcomingBills: 0,
    overdueBills: 0,
    monthlyTotal: 0,
    monthlyPaid: 0,
    categoryBreakdown: []
  })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'overdue' | 'paid'>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'amount' | 'name'>('dueDate')
  const [collapsed, setCollapsed] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchBills()
  }, [])

  useEffect(() => {
    calculateStats()
  }, [bills])

  const fetchBills = async () => {
    setLoading(true)
    try {
      const { API } = await import('../../../lib/api-services')
      const billsData = await API.billReminders.getBillReminders()
      setBills(billsData)
    } catch (error) {
      console.error('Error fetching bills:', error)
      toast({
        title: "Error",
        description: "Failed to load bill reminders",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    let totalBills = bills.length
    let upcomingBills = 0
    let overdueBills = 0
    let monthlyTotal = 0
    let monthlyPaid = 0

    const categoryMap = new Map<string, { amount: number; count: number }>()

    bills.forEach(bill => {
      const dueDate = new Date(bill.dueDate)
      const billMonth = dueDate.getMonth()
      const billYear = dueDate.getFullYear()

      // Count upcoming and overdue
      if (!bill.isPaid) {
        if (isBefore(dueDate, today)) {
          overdueBills++
        } else if (isAfter(dueDate, today)) {
          upcomingBills++
        }
      }

      // Monthly totals
      if (billMonth === currentMonth && billYear === currentYear) {
        monthlyTotal += bill.amount
        if (bill.isPaid) {
          monthlyPaid += bill.amount
        }
      }

      // Category breakdown
      const existing = categoryMap.get(bill.category) || { amount: 0, count: 0 }
      categoryMap.set(bill.category, {
        amount: existing.amount + bill.amount,
        count: existing.count + 1
      })
    })

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    }))

    setStats({
      totalBills,
      upcomingBills,
      overdueBills,
      monthlyTotal,
      monthlyPaid,
      categoryBreakdown
    })
  }

  const getFilteredAndSortedBills = () => {
    const today = new Date()
    let filtered = [...bills]

    // Filter
    switch (filterStatus) {
      case 'upcoming':
        filtered = filtered.filter(bill => {
          const dueDate = new Date(bill.dueDate)
          return !bill.isPaid && isAfter(dueDate, today)
        })
        break
      case 'overdue':
        filtered = filtered.filter(bill => {
          const dueDate = new Date(bill.dueDate)
          return !bill.isPaid && isBefore(dueDate, today)
        })
        break
      case 'paid':
        filtered = filtered.filter(bill => bill.isPaid)
        break
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        case 'amount':
          return b.amount - a.amount
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return filtered
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-dark text-cream overflow-hidden">
        <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-96">
              <LoadingSpinner variant="pulse" size="lg" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <motion.header
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-medium font-outfit">Bill Reminders</h1>
              <p className="text-cream/60 text-sm mt-1 font-outfit">Manage your bills and never miss a payment</p>
            </div>
          </motion.header>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
            <MotionContainer delay={0.1}>
              <MetricCard
                title="Total Bills"
                value={stats.totalBills.toString()}
                secondaryValue={`$${stats.totalBills > 0 ? (stats.monthlyTotal / stats.totalBills).toFixed(0) : 0} avg amount`}
                icon={<Bell className="h-5 w-5" />}
              />
            </MotionContainer>
            <MotionContainer delay={0.2}>
              <MetricCard
                title="Upcoming"
                value={stats.upcomingBills.toString()}
                secondaryValue={`$${bills.filter(bill => !bill.isPaid && isAfter(new Date(bill.dueDate), new Date())).reduce((sum, bill) => sum + bill.amount, 0).toFixed(2)} due`}
                icon={<Clock className="h-5 w-5" />}
              />
            </MotionContainer>
            <MotionContainer delay={0.3}>
              <MetricCard
                title="Overdue"
                value={stats.overdueBills.toString()}
                secondaryValue={`$${bills.filter(bill => !bill.isPaid && isBefore(new Date(bill.dueDate), new Date())).reduce((sum, bill) => sum + bill.amount, 0).toFixed(2)} overdue`}
                icon={<AlertCircle className="h-5 w-5" />}
              />
            </MotionContainer>
            <MotionContainer delay={0.4}>
              <MetricCard
                title="Monthly Total"
                value={`$${stats.monthlyTotal.toFixed(2)}`}
                secondaryValue={`$${stats.monthlyPaid.toFixed(2)} paid`}
                icon={<DollarSign className="h-5 w-5" />}
              />
            </MotionContainer>
          </div>

          {/* Filters and Sort */}
          <MotionContainer delay={0.5}>
            <div className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8 hover:border-cream/20 transition-colors duration-300">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4">
                <div>
                  <label className="text-sm text-cream/60 mb-2 block font-outfit">Filter by Status</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center text-cream/60 text-sm hover:text-cream bg-cream/5 px-3 py-1.5 rounded-md border border-cream/10">
                      {filterStatus === "all" ? "All Bills" : filterStatus === "upcoming" ? "Upcoming" : filterStatus === "overdue" ? "Overdue" : "Paid"}
                      <ChevronRight className="h-4 w-4 ml-2 transform rotate-90" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-dark border-cream/10">
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setFilterStatus("all")}
                      >
                        All Bills
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setFilterStatus("upcoming")}
                      >
                        Upcoming
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setFilterStatus("overdue")}
                      >
                        Overdue
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setFilterStatus("paid")}
                      >
                        Paid
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div>
                  <label className="text-sm text-cream/60 mb-2 block font-outfit">Sort by</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center text-cream/60 text-sm hover:text-cream bg-cream/5 px-3 py-1.5 rounded-md border border-cream/10">
                      {sortBy === "dueDate" ? "Due Date" : sortBy === "amount" ? "Amount" : "Name"}
                      <ChevronRight className="h-4 w-4 ml-2 transform rotate-90" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-dark border-cream/10">
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setSortBy("dueDate")}
                      >
                        Due Date
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setSortBy("amount")}
                      >
                        Amount
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setSortBy("name")}
                      >
                        Name
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="text-sm text-cream/60 font-outfit">
                Showing {getFilteredAndSortedBills().length} of {bills.length} bills
              </div>
            </div>
            </div>
          </MotionContainer>

          {/* Bills Component */}
          <MotionContainer delay={0.6}>
            <div className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium font-outfit">Your Bills</h2>
              </div>
              <BillReminders />
            </div>
          </MotionContainer>
        </div>
      </main>
    </div>
  )
} 