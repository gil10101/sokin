"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Calendar } from '../ui/calendar'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
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
  Trash2
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
    { value: 'utilities', label: 'Utilities', icon: '⚡' },
    { value: 'housing', label: 'Housing', icon: '🏠' },
    { value: 'insurance', label: 'Insurance', icon: '🛡️' },
    { value: 'subscriptions', label: 'Subscriptions', icon: '📱' },
    { value: 'loans', label: 'Loans', icon: '🏦' },
    { value: 'credit-cards', label: 'Credit Cards', icon: '💳' },
    { value: 'other', label: 'Other', icon: '📋' }
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
      const response = await fetch('/api/bill-reminders')
      if (response.ok) {
        const data = await response.json()
        setBills(data.bills || [])
      }
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

      // Check if bill needs a reminder
      bill.reminderDays.forEach(reminderDay => {
        if (daysUntilDue === reminderDay || (daysUntilDue <= 0 && daysUntilDue >= -1)) {
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
    })

    setUpcomingReminders(reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue))
  }

  const createBillReminder = async () => {
    try {
      const billData = {
        ...newBill,
        amount: parseFloat(newBill.amount),
        isPaid: false
      }

      const response = await fetch('/api/bill-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData)
      })

      if (response.ok) {
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
      }
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
      const response = await fetch(`/api/bill-reminders/${billId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidDate: new Date().toISOString() })
      })

      if (response.ok) {
        await fetchBillReminders()
        toast({
          title: "Bill Marked as Paid",
          description: "The bill has been marked as paid."
        })
      }
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

  const getBillStatusColor = (bill: BillReminder) => {
    if (bill.isPaid) return 'bg-green-100 text-green-800'
    
    const dueDate = new Date(bill.dueDate)
    const today = new Date()
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue < 0) return 'bg-red-100 text-red-800'
    if (daysUntilDue <= 3) return 'bg-yellow-100 text-yellow-800'
    return 'bg-blue-100 text-blue-800'
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Bill Reminders</h2>
          <p className="text-muted-foreground">Never miss a payment again</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bills</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={showCreateBill} onOpenChange={setShowCreateBill}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Bill Reminder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billName">Bill Name</Label>
                    <Input
                      id="billName"
                      value={newBill.name}
                      onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
                      placeholder="Electric bill, rent, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={newBill.amount}
                      onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select 
                      value={newBill.category} 
                      onValueChange={(value) => setNewBill({ ...newBill, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {billCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <Select 
                      value={newBill.frequency} 
                      onValueChange={(value: any) => setNewBill({ ...newBill, frequency: value })}
                    >
                      <SelectTrigger>
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
                  className="w-full"
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
        <Card className="border-l-4 border-l-orange-500 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-orange-600" />
              <div>
                <h3 className="font-medium text-orange-900">
                  {upcomingReminders.length} Bill{upcomingReminders.length > 1 ? 's' : ''} Need Attention
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {upcomingReminders.slice(0, 3).map((reminder) => (
                    <Badge key={reminder.billId} variant="outline" className="text-orange-800">
                      {reminder.billName} - {reminder.daysUntilDue <= 0 ? 'Overdue' : `${reminder.daysUntilDue} days`}
                    </Badge>
                  ))}
                  {upcomingReminders.length > 3 && (
                    <Badge variant="outline" className="text-orange-800">
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
      <div className="grid gap-4">
        <AnimatePresence>
          {getFilteredBills().map((bill) => {
            const categoryInfo = billCategories.find(c => c.value === bill.category)
            const nextDueDate = getNextDueDate(bill)

            return (
              <motion.div
                key={bill.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">{categoryInfo?.icon}</div>
                        <div>
                          <h3 className="font-medium">{bill.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            <span>Due {format(nextDueDate, 'MMM dd, yyyy')}</span>
                            <span>•</span>
                            <span>{bill.frequency}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold">${bill.amount.toFixed(2)}</div>
                          <Badge className={getBillStatusColor(bill)}>
                            {getBillStatusText(bill)}
                          </Badge>
                        </div>

                        {!bill.isPaid && (
                          <Button
                            size="sm"
                            onClick={() => markBillAsPaid(bill.id!)}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Mark Paid
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

      {/* Empty State */}
      {getFilteredBills().length === 0 && !loading && (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No bills found</h3>
          <p className="text-muted-foreground mb-4">
            {filterStatus === 'all' 
              ? "Add your first bill reminder to get started"
              : `No ${filterStatus} bills at the moment`
            }
          </p>
          {filterStatus === 'all' && (
            <Button onClick={() => setShowCreateBill(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Bill
            </Button>
          )}
        </div>
      )}
    </div>
  )
} 