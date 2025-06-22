"use client"

import { useState, useEffect } from 'react'
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
  reminderDays: number[] // [7, 3, 1] days before
  autoPayEnabled: boolean
  linkedAccount?: string
  createdAt: string
  updatedAt?: string
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
    frequency: 'monthly' as const,
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

  useEffect(() => {
    fetchBillReminders()
  }, [])

  useEffect(() => {
    generateUpcomingReminders()
  }, [bills])

  const fetchBillReminders = async () => {
    setLoading(true)
    try {
      // Import the API service
      const { API } = await import('../../lib/api-services')
      const bills = await API.billReminders.getBillReminders()
      setBills(bills)
    } catch (error) {
      console.error('Error fetching bill reminders:', error)
      toast({
        title: "Error",
        description: "Failed to load bill reminders",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const generateUpcomingReminders = () => {
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
  }

  const createBillReminder = async () => {
    try {
      const { API } = await import('../../lib/api-services')
      const billData = {
        name: newBill.name,
        amount: parseFloat(newBill.amount),
        dueDate: newBill.dueDate.toISOString(),
        frequency: newBill.frequency,
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
      console.error('Error creating bill reminder:', error)
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
      console.error('Error marking bill as paid:', error)
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
    <div className="w-full max-w-full overflow-hidden">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl lg:text-2xl font-semibold text-cream/90 truncate">Bill Reminders</h2>
            <p className="text-sm md:text-base text-cream/60 mt-1">Never miss a payment again</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 md:gap-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center text-cream/60 text-sm hover:text-cream bg-cream/5 px-3 py-2 sm:py-1.5 rounded-md border border-cream/10 w-full sm:w-auto md:min-w-[120px]">
                <span className="truncate">
                  {filterStatus === "all" ? "All Bills" : filterStatus === "upcoming" ? "Upcoming" : filterStatus === "overdue" ? "Overdue" : "Paid"}
                </span>
                <ChevronRight className="h-4 w-4 ml-2 transform rotate-90 flex-shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-dark border-cream/10 w-full sm:w-auto min-w-[150px]">
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
            
            <Dialog open={showCreateBill} onOpenChange={setShowCreateBill}>
              <DialogTrigger asChild>
                <Button className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 w-full sm:w-auto md:min-w-[110px] flex-shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="sm:inline">Add Bill</span>
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
                        onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
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
                        onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
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
                        onValueChange={(value: any) => setNewBill({ ...newBill, frequency: value })}
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
        </div>

        {/* Upcoming Reminders Alert */}
        {upcomingReminders.length > 0 && (
          <Card className="border-l-4 border-l-cream/40 bg-cream/5">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-cream/60 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-cream/80 text-sm md:text-base">
                    {upcomingReminders.length} Bill{upcomingReminders.length > 1 ? 's' : ''} Need Attention
                  </h3>
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2">
                    {upcomingReminders.slice(0, 3).map((reminder) => (
                      <Badge key={reminder.billId} variant="outline" className="border-cream/20 text-cream/70 text-xs px-2 py-0.5">
                        <span className="truncate max-w-[120px] md:max-w-none">
                          {reminder.billName}
                        </span>
                        <span className="ml-1 flex-shrink-0">
                          - {reminder.daysUntilDue <= 0 ? 'Overdue' : `${reminder.daysUntilDue}d`}
                        </span>
                      </Badge>
                    ))}
                    {upcomingReminders.length > 3 && (
                      <Badge variant="outline" className="border-cream/20 text-cream/70 text-xs px-2 py-0.5">
                        +{upcomingReminders.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bills List */}
        <div className="w-full overflow-hidden">
          <div className="grid gap-3 md:gap-4">
            <AnimatePresence>
              {getFilteredBills().map((bill) => {
                const categoryInfo = billCategories.find(c => c.value === bill.category)
                const nextDueDate = getNextDueDate(bill)
                const IconComponent = categoryInfo?.icon || FileText

                return (
                  <motion.div
                    key={bill.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full"
                  >
                    <Card className="bg-cream/5 border-cream/20 hover:bg-cream/10 transition-colors w-full">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-cream/10 flex items-center justify-center flex-shrink-0">
                              <IconComponent className="h-4 w-4 md:h-5 md:w-5 text-cream/60" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-cream/90 text-sm md:text-base truncate">{bill.name}</h3>
                              <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-cream/60 mt-0.5">
                                <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">Due {format(nextDueDate, 'MMM dd, yyyy')}</span>
                                <span className="hidden md:inline">•</span>
                                <span className="hidden md:inline">{bill.frequency}</span>
                              </div>
                              <div className="md:hidden text-xs text-cream/50 mt-0.5">
                                {bill.frequency}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 flex-shrink-0">
                            <div className="text-left md:text-right">
                              <div className="font-semibold text-cream/90 text-base md:text-lg">${bill.amount.toFixed(2)}</div>
                              <Badge variant="outline" className="border-cream/20 text-cream/60 text-xs mt-1">
                                {getBillStatusText(bill)}
                              </Badge>
                            </div>

                            {!bill.isPaid && (
                              <Button
                                size="sm"
                                onClick={() => markBillAsPaid(bill.id!)}
                                className="flex items-center gap-1 bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 px-2 md:px-3 py-1.5 text-xs md:text-sm flex-shrink-0"
                              >
                                <CheckCircle className="h-3 w-3" />
                                <span className="hidden md:inline">Mark Paid</span>
                                <span className="md:hidden">Paid</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Empty State */}
        {getFilteredBills().length === 0 && !loading && (
          <div className="text-center py-8 md:py-12 px-4">
            <Bell className="h-10 w-10 md:h-12 md:w-12 text-cream/40 mx-auto mb-3 md:mb-4" />
            <h3 className="text-base md:text-lg font-medium mb-2 text-cream/70">No bills found</h3>
            <p className="text-sm md:text-base text-cream/50 mb-4 max-w-md mx-auto">
              {filterStatus === 'all' 
                ? "Add your first bill reminder to get started"
                : `No ${filterStatus} bills at the moment`
              }
            </p>
            {filterStatus === 'all' && (
              <Button 
                onClick={() => setShowCreateBill(true)}
                className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 w-full md:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Bill
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 