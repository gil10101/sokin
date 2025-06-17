"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, addDays, isWithinInterval, isBefore, isAfter } from "date-fns"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { PageHeader } from "../../../components/dashboard/page-header"
import { BillReminders } from "../../../components/dashboard/bill-reminders"
import { Button } from "../../../components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Badge } from "../../../components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu"
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
import { motion, AnimatePresence } from "framer-motion"
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 bg-cream/5 border-cream/20 hover:bg-cream/10 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </motion.header>

          {/* Stats Cards */}
          <motion.div 
            variants={container} 
            initial="hidden" 
            animate="show" 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            <motion.div
              variants={item}
              className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cream/60 font-outfit">Total Bills</p>
                  <p className="text-2xl font-medium text-cream font-outfit">{stats.totalBills}</p>
                </div>
                <Bell className="h-8 w-8 text-cream/40" />
              </div>
            </motion.div>

            <motion.div
              variants={item}
              className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cream/60 font-outfit">Upcoming</p>
                  <p className="text-2xl font-medium text-yellow-400 font-outfit">{stats.upcomingBills}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400/60" />
              </div>
            </motion.div>

            <motion.div
              variants={item}
              className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cream/60 font-outfit">Overdue</p>
                  <p className="text-2xl font-medium text-red-400 font-outfit">{stats.overdueBills}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-400/60" />
              </div>
            </motion.div>

            <motion.div
              variants={item}
              className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cream/60 font-outfit">Monthly Total</p>
                  <p className="text-2xl font-medium text-green-400 font-outfit">${stats.monthlyTotal.toFixed(2)}</p>
                  <p className="text-xs text-cream/40 font-outfit">
                    ${stats.monthlyPaid.toFixed(2)} paid
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400/60" />
              </div>
            </motion.div>
          </motion.div>

          {/* Filters and Sort */}
          <motion.div
            variants={item}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.5 }}
            className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8 hover:border-cream/20 transition-colors duration-300"
          >
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
          </motion.div>

          {/* Bills Component */}
          <motion.div
            variants={item}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.6 }}
            className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium font-outfit">Your Bills</h2>
            </div>
            <BillReminders />
          </motion.div>
        </div>
      </main>
    </div>
  )
} 