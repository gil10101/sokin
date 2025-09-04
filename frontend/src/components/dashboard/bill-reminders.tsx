"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Calendar } from '../ui/calendar'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { 
  Bell, 
  Calendar as CalendarIcon, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Plus,
  Settings,
  Trash2,
  Zap,
  Home,
  Shield,
  Smartphone,
  Building,
  CreditCard,
  FileText,
  ChevronRight
} from 'lucide-react'
import { format, addDays, isWithinInterval, isBefore, isAfter } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../../hooks/use-toast'

// Import BillReminder from API services for consistency
type ApiBillReminder = {
  id: string;
  userId: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly';
  category?: string;
  notes?: string;
  isPaid: boolean;
  paidDate?: string;
  createdAt: string;
  updatedAt?: string;
}

// Extended version with additional UI fields
interface BillReminder extends Omit<ApiBillReminder, 'frequency' | 'category'> {
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time'
  category: string
  description?: string
  reminderDays: number[] // [7, 3, 1] days before
  autoPayEnabled: boolean
  linkedAccount?: string
}

interface ReminderNotification {
  billId: string
  billName: string
  amount: number
  dueDate: string
  daysUntilDue: number
  priority: 'low' | 'medium' | 'high'
}

export function BillReminders() {
  const [bills, setBills] = useState<BillReminder[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateBill, setShowCreateBill] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'overdue' | 'paid'>('all')
  const { toast } = useToast()

  // Form state for new bill
  const [newBill, setNewBill] = useState({
    name: '',
    amount: '',
    dueDate: new Date(),
            frequency: 'monthly' as BillReminder['frequency'],
    category: 'utilities',
    description: '',
    reminderDays: [7, 3, 1],
    autoPayEnabled: false
  })

  const billCategories = [
    { value: 'utilities', label: 'Utilities', icon: Zap },
    { value: 'housing', label: 'Housing', icon: Home },
    { value: 'insurance', label: 'Insurance', icon: Shield },
    { value: 'subscriptions', label: 'Subscriptions', icon: Smartphone },
    { value: 'loans', label: 'Loans', icon: Building },
    { value: 'credit-cards', label: 'Credit Cards', icon: CreditCard },
    { value: 'other', label: 'Other', icon: FileText }
  ]

  const fetchBillReminders = useCallback(async () => {
    setLoading(true)
    try {
      // Import the API service
      const { API } = await import('../../lib/api-services')
      const apiBills = await API.billReminders.getBillReminders() as ApiBillReminder[]
      // Transform API bills to extended BillReminder format
      const transformedBills: BillReminder[] = apiBills.map(bill => ({
        ...bill,
        category: bill.category || 'other',
        description: bill.notes,
        reminderDays: [7, 3, 1],
        autoPayEnabled: false,
        frequency: bill.frequency === 'once' ? 'one-time' : bill.frequency as BillReminder['frequency']
      }))
      setBills(transformedBills)
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to load bill reminders",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const generateUpcomingReminders = useCallback(() => {
    const today = new Date()
    const reminders: ReminderNotification[] = []

    bills.forEach(bill => {
      if (bill.isPaid) return

      const dueDate = new Date(bill.dueDate)
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Check if bill needs a reminder (only add one reminder per bill, prioritizing the closest match)
      const matchingReminderDays = bill.reminderDays.filter(reminderDay => 
        daysUntilDue === reminderDay || (daysUntilDue <= 0 && daysUntilDue >= -1)
      )

      if (matchingReminderDays.length > 0) {
        let priority: 'low' | 'medium' | 'high' = 'low'
        
        if (daysUntilDue <= 0) priority = 'high'
        else if (daysUntilDue <= 3) priority = 'medium'
        
        reminders.push({
          billId: bill.id!,
          billName: bill.name,
          amount: bill.amount,
          dueDate: bill.dueDate,
          daysUntilDue,
          priority
        })
      }
    })

    setUpcomingReminders(reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue))
  }, [bills])

  // Add useEffect hooks after function declarations
  useEffect(() => {
    fetchBillReminders()
  }, [fetchBillReminders])

  useEffect(() => {
    generateUpcomingReminders()
  }, [bills, generateUpcomingReminders])

  const createBillReminder = async () => {
    try {
      const { API } = await import('../../lib/api-services')
      // Map UI frequency values to API values
      const mapFrequencyToApi = (freq: BillReminder['frequency']): ApiBillReminder['frequency'] => {
        switch (freq) {
          case 'one-time': return 'once'
          case 'quarterly': return 'yearly' // Map quarterly to yearly for now
          default: return freq as ApiBillReminder['frequency']
        }
      }
      
      const billData = {
        name: newBill.name,
        amount: parseFloat(newBill.amount),
        dueDate: newBill.dueDate.toISOString(),
        frequency: mapFrequencyToApi(newBill.frequency),
        category: newBill.category,
        notes: newBill.description
      }

      await API.billReminders.createBillReminder(billData)
      await fetchBillReminders()
      setShowCreateBill(false)
      setNewBill({
        name: '',
        amount: '',
        dueDate: new Date(),
        frequency: 'monthly',
        category: 'utilities',
        description: '',
        reminderDays: [7, 3, 1],
        autoPayEnabled: false
      })
      toast({
        title: "Bill Reminder Created",
        description: `Reminder for "${billData.name}" has been set up.`
      })
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to create bill reminder",
        variant: "destructive"
      })
    }
  }

  const markBillAsPaid = async (billId: string) => {
    try {
      const { API } = await import('../../lib/api-services')
      await API.billReminders.markBillPaid(billId, new Date().toISOString())
      await fetchBillReminders()
      toast({
        title: "Bill Marked as Paid",
        description: "The bill has been marked as paid."
      })
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to mark bill as paid",
        variant: "destructive"
      })
    }
  }

  const getFilteredBills = () => {
    const today = new Date()
    
    switch (filterStatus) {
      case 'upcoming':
        return bills.filter(bill => {
          const dueDate = new Date(bill.dueDate)
          return !bill.isPaid && isAfter(dueDate, today)
        })
      case 'overdue':
        return bills.filter(bill => {
          const dueDate = new Date(bill.dueDate)
          return !bill.isPaid && isBefore(dueDate, today)
        })
      case 'paid':
        return bills.filter(bill => bill.isPaid)
      default:
        return bills
    }
  }

  const getBillStatusText = (bill: BillReminder) => {
    if (bill.isPaid) return 'Paid'
    
    const dueDate = new Date(bill.dueDate)
    const today = new Date()
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue < 0) return `Overdue by ${Math.abs(daysUntilDue)} days`
    if (daysUntilDue === 0) return 'Due today'
    if (daysUntilDue === 1) return 'Due tomorrow'
    return `Due in ${daysUntilDue} days`
  }

  const getNextDueDate = (bill: BillReminder) => {
    const dueDate = new Date(bill.dueDate)
    const today = new Date()
    
    if (isBefore(dueDate, today) && bill.frequency !== 'one-time') {
      // Calculate next occurrence
      const diff = today.getTime() - dueDate.getTime()
      const daysDiff = Math.ceil(diff / (1000 * 60 * 60 * 24))
      
      switch (bill.frequency) {
        case 'weekly':
          const weeksToAdd = Math.ceil(daysDiff / 7)
          return addDays(dueDate, weeksToAdd * 7)
        case 'monthly':
          const monthsToAdd = Math.ceil(daysDiff / 30)
          const nextMonth = new Date(dueDate)
          nextMonth.setMonth(nextMonth.getMonth() + monthsToAdd)
          return nextMonth
        case 'quarterly':
          const quartersToAdd = Math.ceil(daysDiff / 90)
          const nextQuarter = new Date(dueDate)
          nextQuarter.setMonth(nextQuarter.getMonth() + (quartersToAdd * 3))
          return nextQuarter
        case 'yearly':
          const yearsToAdd = Math.ceil(daysDiff / 365)
          const nextYear = new Date(dueDate)
          nextYear.setFullYear(nextYear.getFullYear() + yearsToAdd)
          return nextYear
        default:
          return dueDate
      }
    }
    
    return dueDate
  }

  if (loading) {
    return (
      <div className="w-full max-w-full overflow-hidden">
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col gap-3 md:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="h-6 md:h-8 w-40 md:w-48 bg-cream/10 rounded animate-pulse mb-2" />
              <div className="h-3 md:h-4 w-48 md:w-64 bg-cream/5 rounded animate-pulse" />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 md:gap-2 flex-shrink-0">
              <div className="h-10 w-full sm:w-32 md:min-w-[120px] bg-cream/10 rounded animate-pulse" />
              <div className="h-10 w-full sm:w-24 md:min-w-[110px] bg-cream/10 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-3 md:space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 md:h-20 bg-cream/5 rounded-lg animate-pulse w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden h-full flex flex-col">
      <div className="flex-1 space-y-2 md:space-y-3 min-h-0">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center text-cream/60 text-xs hover:text-cream bg-cream/5 px-2 py-1 rounded border border-cream/10">
              <span className="truncate text-xs">
                {filterStatus === "all" ? "All" : filterStatus === "upcoming" ? "Due" : filterStatus === "overdue" ? "Late" : "Paid"}
              </span>
              <ChevronRight className="h-3 w-3 ml-1 transform rotate-90" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-dark border-cream/10">
              <DropdownMenuItem
                className="text-cream hover:bg-cream/10 cursor-pointer text-xs"
                onClick={() => setFilterStatus("all")}
              >
                All Bills
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-cream hover:bg-cream/10 cursor-pointer text-xs"
                onClick={() => setFilterStatus("upcoming")}
              >
                Upcoming
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-cream hover:bg-cream/10 cursor-pointer text-xs"
                onClick={() => setFilterStatus("overdue")}
              >
                Overdue
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-cream hover:bg-cream/10 cursor-pointer text-xs"
                onClick={() => setFilterStatus("paid")}
              >
                Paid
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Dialog open={showCreateBill} onOpenChange={setShowCreateBill}>
            <DialogTrigger asChild>
              <Button className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 px-2 py-1 text-xs h-auto">
                <Plus className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 sm:mx-0 md:mx-auto sm:max-w-md md:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg md:text-xl">Add Bill Reminder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 md:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-1">
                    <Label htmlFor="billName" className="text-sm md:text-base">Bill Name</Label>
                    <Input
                      id="billName"
                      value={newBill.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBill({ ...newBill, name: e.target.value })}
                      placeholder="Electric bill, rent, etc."
                      className="mt-1 md:mt-2"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="amount" className="text-sm md:text-base">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={newBill.amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewBill({ ...newBill, amount: e.target.value })}
                      placeholder="0.00"
                      className="mt-1 md:mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm md:text-base">Category</Label>
                    <Select 
                      value={newBill.category} 
                      onValueChange={(value) => setNewBill({ ...newBill, category: value })}
                    >
                      <SelectTrigger className="mt-1 md:mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {billCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <cat.icon className="h-4 w-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm md:text-base">Frequency</Label>
                    <Select 
                      value={newBill.frequency} 
                      onValueChange={(value: BillReminder['frequency']) => setNewBill({ ...newBill, frequency: value })}
                    >
                      <SelectTrigger className="mt-1 md:mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={createBillReminder} 
                  className="w-full mt-6"
                  disabled={!newBill.name || !newBill.amount}
                >
                  Add Bill Reminder
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Compact Upcoming Alert */}
        {upcomingReminders.length > 0 && (
          <div className="bg-cream/5 border border-cream/10 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <Bell className="h-3 w-3 text-cream/60" />
              <span className="text-xs text-cream/70">
                {upcomingReminders.length} due soon
              </span>
            </div>
          </div>
        )}

        {/* Compact Bills List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-1.5">
            <AnimatePresence>
              {getFilteredBills().slice(0, 4).map((bill) => {
                const categoryInfo = billCategories.find(c => c.value === bill.category)
                const nextDueDate = getNextDueDate(bill)
                const IconComponent = categoryInfo?.icon || FileText

                return (
                  <motion.div
                    key={bill.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="w-full"
                  >
                    <div className="bg-cream/5 border border-cream/10 hover:bg-cream/8 transition-colors rounded-lg p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="h-6 w-6 rounded-full bg-cream/10 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-3 w-3 text-cream/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-cream/90 text-xs truncate">{bill.name}</h3>
                            <div className="flex items-center gap-1 text-xs text-cream/60">
                              <CalendarIcon className="h-2.5 w-2.5" />
                              <span className="truncate">{format(nextDueDate, 'MMM dd')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-medium text-cream/90 text-xs">${bill.amount.toFixed(0)}</div>
                            <div className="text-xs text-cream/50">
                              {getBillStatusText(bill).split(' ')[0]}
                            </div>
                          </div>

                          {!bill.isPaid && (
                            <Button
                              size="sm"
                              onClick={() => markBillAsPaid(bill.id!)}
                              className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 px-1.5 py-1 text-xs h-auto"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Compact Empty State */}
        {getFilteredBills().length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center text-center py-4">
            <div>
              <Bell className="h-6 w-6 text-cream/40 mx-auto mb-2" />
              <p className="text-xs text-cream/60 mb-2">
                {filterStatus === 'all' ? "No bills yet" : `No ${filterStatus} bills`}
              </p>
              {filterStatus === 'all' && (
                <Button 
                  onClick={() => setShowCreateBill(true)}
                  className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 px-3 py-1 text-xs h-auto"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add Bill
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}