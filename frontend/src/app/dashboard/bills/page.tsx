"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"

import { isBefore, isAfter, startOfDay } from "date-fns"
import { BillReminders } from "@/components/dashboard/bill-reminders"
import { MetricCard } from "@/components/dashboard/metric-card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MotionContainer } from "@/components/ui/motion-container"
import {
  Bell,
  DollarSign,
  AlertCircle,
  Clock,
  ChevronRight
} from "lucide-react"
import { MotionDiv, MotionMain, MotionHeader } from "@/components/ui/dynamic-motion"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AddButton } from "@/components/ui/add-button"
import { API } from "@/lib/api"
import { useCurrency } from "@/hooks/use-currency"

interface BillReminder {
  id: string
  userId: string
  name: string
  amount: number
  dueDate: string
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly'
  category?: string
  notes?: string
  isPaid: boolean
  paidDate?: string
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

interface BillsPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function BillsPage(props: BillsPageProps) {
  const { format: formatCurrency } = useCurrency()
  const [bills, setBills] = useState<BillReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'overdue' | 'paid'>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'amount' | 'name'>('dueDate')
  const [showCreateBill, setShowCreateBill] = useState(false)
  const { toast } = useToast()

  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const billsData = await API.billReminders.getBillReminders()
      setBills(billsData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load bill reminders",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const stats = useMemo(() => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    const totalBills = bills.length
    let upcomingBills = 0
    let overdueBills = 0
    let monthlyTotal = 0
    let monthlyPaid = 0
    let monthlyBillCount = 0

    const categoryMap = new Map<string, { amount: number; count: number }>()

    bills.forEach(bill => {
      const dueDate = new Date(bill.dueDate)
      const billMonth = dueDate.getMonth()
      const billYear = dueDate.getFullYear()

      if (!bill.isPaid) {
        if (isBefore(startOfDay(dueDate), startOfDay(today))) {
          overdueBills++
        } else {
          upcomingBills++
        }
      }

      if (billMonth === currentMonth && billYear === currentYear) {
        monthlyTotal += bill.amount
        monthlyBillCount++
        if (bill.isPaid) {
          monthlyPaid += bill.amount
        }
      }

      const categoryKey = bill.category || 'Other'
      const existing = categoryMap.get(categoryKey) || { amount: 0, count: 0 }
      categoryMap.set(categoryKey, {
        amount: existing.amount + bill.amount,
        count: existing.count + 1
      })
    })

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    }))

    return { totalBills, upcomingBills, overdueBills, monthlyTotal, monthlyPaid, monthlyBillCount, categoryBreakdown }
  }, [bills])

  useEffect(() => {
    fetchBills()
  }, [fetchBills])

  const filteredAndSortedBills = useMemo(() => {
    const today = new Date()
    let filtered = [...bills]

    switch (filterStatus) {
      case 'upcoming':
        filtered = filtered.filter(bill => {
          const dueDate = new Date(bill.dueDate)
          return !bill.isPaid && !isBefore(startOfDay(dueDate), startOfDay(today))
        })
        break
      case 'overdue':
        filtered = filtered.filter(bill => {
          const dueDate = new Date(bill.dueDate)
          return !bill.isPaid && isBefore(startOfDay(dueDate), startOfDay(today))
        })
        break
      case 'paid':
        filtered = filtered.filter(bill => bill.isPaid)
        break
    }

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
  }, [bills, filterStatus, sortBy])

  if (loading) {
    return (
      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <LoadingSpinner variant="pulse" size="lg" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <MotionHeader
          className="flex items-center justify-between mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-medium font-outfit">Bill Reminders</h1>
            <p className="text-cream/60 text-sm mt-1 font-outfit">Manage your bills and never miss a payment</p>
          </div>
          <AddButton
            label="Bill"
            onClick={() => setShowCreateBill(true)}
          />
        </MotionHeader>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
          <MotionContainer delay={0.1}>
            <MetricCard
              title="Total Bills"
              value={stats.totalBills.toString()}
              secondaryValue={`${formatCurrency(stats.monthlyBillCount > 0 ? stats.monthlyTotal / stats.monthlyBillCount : 0, { decimals: 0 })} avg this month`}
              icon={<Bell className="h-5 w-5" />}
            />
          </MotionContainer>
          <MotionContainer delay={0.2}>
            <MetricCard
              title="Upcoming"
              value={stats.upcomingBills.toString()}
              secondaryValue={`${formatCurrency(bills.filter(bill => !bill.isPaid && !isBefore(startOfDay(new Date(bill.dueDate)), startOfDay(new Date()))).reduce((sum, bill) => sum + bill.amount, 0))} due`}
              icon={<Clock className="h-5 w-5" />}
            />
          </MotionContainer>
          <MotionContainer delay={0.3}>
            <MetricCard
              title="Overdue"
              value={stats.overdueBills.toString()}
              secondaryValue={`${formatCurrency(bills.filter(bill => !bill.isPaid && isBefore(startOfDay(new Date(bill.dueDate)), startOfDay(new Date()))).reduce((sum, bill) => sum + bill.amount, 0))} overdue`}
              icon={<AlertCircle className="h-5 w-5" />}
            />
          </MotionContainer>
          <MotionContainer delay={0.4}>
            <MetricCard
              title="Monthly Total"
              value={formatCurrency(stats.monthlyTotal, { decimals: 0 })}
              secondaryValue={`${formatCurrency(stats.monthlyPaid)} paid`}
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
              Showing {filteredAndSortedBills.length} of {bills.length} bills
            </div>
          </div>
          </div>
        </MotionContainer>

        {/* Bills Component */}
        <MotionContainer delay={0.6}>
          <div className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium font-outfit">Bills</h2>
            </div>
            <BillReminders
              externalShowCreate={showCreateBill}
              onExternalShowCreateChange={setShowCreateBill}
              hideInternalAddButton={true}
              limit={Number.POSITIVE_INFINITY}
              filterStatus={filterStatus}
              sortBy={sortBy}
              hideInternalFilters={true}
              onBillsChanged={fetchBills}
            />
          </div>
        </MotionContainer>
      </div>
    </main>
  )
} 