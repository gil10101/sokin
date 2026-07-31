"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog'
import { Switch } from '../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import {
  Bell,
  Calendar as CalendarIcon,
  CheckCircle,
  Plus,
  Pencil,
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
import {
  format,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  differenceInCalendarDays,
  isBefore,
  startOfDay
} from 'date-fns'
import { MotionDiv, AnimatePresence } from "@/components/ui/dynamic-motion"
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { API } from '@/lib/api'

// Shape returned by the bill reminders API. The lib/api.ts types lag behind the
// backend schema, which also stores description, reminderDays and autoPayEnabled
// and supports 'quarterly' / 'one-time' frequencies.
type ApiBillReminder = {
  id: string;
  userId: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  category?: string;
  notes?: string;
  description?: string;
  reminderDays?: number[];
  autoPayEnabled?: boolean;
  isPaid: boolean;
  paidDate?: string;
  createdAt: string;
  updatedAt?: string;
}

// Extended version with additional UI fields
interface BillReminder extends Omit<ApiBillReminder, 'frequency' | 'category' | 'reminderDays' | 'autoPayEnabled'> {
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

export type BillFilterStatus = 'all' | 'upcoming' | 'overdue' | 'paid'
export type BillSortBy = 'dueDate' | 'amount' | 'name'

interface BillRemindersProps {
  /** External control for showing the create dialog */
  externalShowCreate?: boolean
  /** Callback when external create dialog state changes */
  onExternalShowCreateChange?: (show: boolean) => void
  /** Hide the internal add button when using external control */
  hideInternalAddButton?: boolean
  /** Maximum number of bills to render (defaults to 4 for the dashboard widget) */
  limit?: number
  /** Controlled status filter — overrides the internal filter dropdown */
  filterStatus?: BillFilterStatus
  /** Sort order for the rendered list */
  sortBy?: BillSortBy
  /** Hide the internal filter dropdown when filtering is controlled by the parent */
  hideInternalFilters?: boolean
  /** Notify the parent after create/update/delete/mark-paid so it can refresh derived data */
  onBillsChanged?: () => void
}

const EMPTY_BILLS: BillReminder[] = []
const REMINDER_DAY_OPTIONS = [7, 3, 1]
const DEFAULT_REMINDER_DAYS = [7, 3, 1]

const createEmptyBillForm = () => ({
  name: '',
  amount: '',
  dueDate: format(new Date(), 'yyyy-MM-dd'),
  frequency: 'monthly' as BillReminder['frequency'],
  category: 'utilities',
  description: '',
  reminderDays: [...DEFAULT_REMINDER_DAYS],
  autoPayEnabled: false
})

export function BillReminders({
  externalShowCreate,
  onExternalShowCreateChange,
  hideInternalAddButton = false,
  limit = 4,
  filterStatus: controlledFilterStatus,
  sortBy = 'dueDate',
  hideInternalFilters = false,
  onBillsChanged
}: BillRemindersProps = {}) {
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderNotification[]>([])
  const [internalShowCreate, setInternalShowCreate] = useState(false)

  // Use external control if both props provided, otherwise use internal state
  // This prevents state mismatch when read prop is provided without write handler
  const isExternallyControlled = externalShowCreate !== undefined && onExternalShowCreateChange !== undefined
  const showCreateBill = isExternallyControlled ? externalShowCreate : internalShowCreate
  const setShowCreateBill = isExternallyControlled ? onExternalShowCreateChange : setInternalShowCreate

  const [internalFilterStatus, setInternalFilterStatus] = useState<BillFilterStatus>('all')
  // A controlled filter from the parent wins over the internal dropdown
  const filterStatus = controlledFilterStatus ?? internalFilterStatus

  // Shared form state for the add and edit dialogs
  const [billForm, setBillForm] = useState(createEmptyBillForm)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [editingBill, setEditingBill] = useState<BillReminder | null>(null)
  const [billToDelete, setBillToDelete] = useState<BillReminder | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const billCategories = [
    { value: 'utilities', label: 'Utilities', icon: Zap },
    { value: 'housing', label: 'Housing', icon: Home },
    { value: 'insurance', label: 'Insurance', icon: Shield },
    { value: 'subscriptions', label: 'Subscriptions', icon: Smartphone },
    { value: 'loans', label: 'Loans', icon: Building },
    { value: 'credit-cards', label: 'Credit Cards', icon: CreditCard },
    { value: 'other', label: 'Other', icon: FileText }
  ]

  const {
    data: bills = EMPTY_BILLS,
    isLoading: loading,
    refetch: fetchBillReminders,
  } = useQuery<BillReminder[]>({
    queryKey: ['bill-reminders', user?.uid],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const apiBills = await API.billReminders.getBillReminders() as ApiBillReminder[]
      // Transform API bills to extended BillReminder format
      const transformedBills: BillReminder[] = apiBills.map(bill => ({
        ...bill,
        category: bill.category || 'other',
        description: bill.description ?? bill.notes,
        reminderDays: bill.reminderDays && bill.reminderDays.length > 0 ? bill.reminderDays : [...DEFAULT_REMINDER_DAYS],
        autoPayEnabled: bill.autoPayEnabled ?? false,
        frequency: bill.frequency === 'once' ? 'one-time' : bill.frequency
      }))
      return transformedBills
    },
  })

  // Keep the dashboard's upcoming-bills analytics (react-query) and the parent
  // page in sync after any mutation
  const notifyBillsChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['upcoming-bills'] })
    onBillsChanged?.()
  }, [queryClient, onBillsChanged])

  const generateUpcomingReminders = useCallback(() => {
    const today = startOfDay(new Date())
    const reminders: ReminderNotification[] = []

    bills.forEach(bill => {
      if (bill.isPaid) return

      const dueDate = startOfDay(new Date(bill.dueDate))
      const daysUntilDue = differenceInCalendarDays(dueDate, today)
      const maxReminderDay = bill.reminderDays.length > 0 ? Math.max(...bill.reminderDays) : 0

      // Show a reminder for anything inside the largest reminder window;
      // overdue bills (negative daysUntilDue) always show
      if (!(daysUntilDue <= maxReminderDay)) return

      let priority: 'low' | 'medium' | 'high' = 'low'

      if (daysUntilDue <= 0) priority = 'high'
      else if (daysUntilDue <= 3) priority = 'medium'

      reminders.push({
        billId: bill.id,
        billName: bill.name,
        amount: bill.amount,
        dueDate: bill.dueDate,
        daysUntilDue,
        priority
      })
    })

    setUpcomingReminders(reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue))
  }, [bills])

  useEffect(() => {
    generateUpcomingReminders()
  }, [bills, generateUpcomingReminders])

  // Reset the shared form whenever the create dialog opens (the form is also
  // used by the edit dialog and may hold stale values)
  useEffect(() => {
    if (showCreateBill) {
      setBillForm(createEmptyBillForm())
      setAmountError(null)
    }
  }, [showCreateBill])

  const validateAmount = () => {
    const amount = Number(billForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setAmountError('Enter an amount greater than 0')
      return null
    }
    setAmountError(null)
    return amount
  }

  const buildBillPayload = (amount: number) => ({
    name: billForm.name.trim(),
    amount,
    dueDate: new Date(`${billForm.dueDate}T00:00:00`).toISOString(),
    frequency: billForm.frequency,
    category: billForm.category,
    description: billForm.description,
    reminderDays: billForm.reminderDays,
    autoPayEnabled: billForm.autoPayEnabled
  })

  const createBillReminder = async () => {
    const amount = validateAmount()
    if (amount === null) return

    try {
      const billData = buildBillPayload(amount)
      // lib/api.ts payload types predate the current backend schema
      // (quarterly/one-time frequencies, description, reminderDays, autoPayEnabled)
      await API.billReminders.createBillReminder(
        billData as unknown as Parameters<typeof API.billReminders.createBillReminder>[0]
      )
      await fetchBillReminders()
      notifyBillsChanged()
      setShowCreateBill(false)
      setBillForm(createEmptyBillForm())
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

  const updateBillReminder = async () => {
    if (!editingBill) return
    const amount = validateAmount()
    if (amount === null) return

    try {
      const billData = buildBillPayload(amount)
      await API.billReminders.updateBillReminder(
        editingBill.id,
        billData as unknown as Parameters<typeof API.billReminders.updateBillReminder>[1]
      )
      await fetchBillReminders()
      notifyBillsChanged()
      setEditingBill(null)
      setBillForm(createEmptyBillForm())
      toast({
        title: "Bill Reminder Updated",
        description: `"${billData.name}" has been updated.`
      })
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to update bill reminder",
        variant: "destructive"
      })
    }
  }

  const deleteBillReminder = async () => {
    if (!billToDelete) return

    try {
      await API.billReminders.deleteBillReminder(billToDelete.id)
      await fetchBillReminders()
      notifyBillsChanged()
      toast({
        title: "Bill Reminder Deleted",
        description: `"${billToDelete.name}" has been deleted.`
      })
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to delete bill reminder",
        variant: "destructive"
      })
    } finally {
      setBillToDelete(null)
    }
  }

  const markBillAsPaid = async (billId: string) => {
    try {
      await API.billReminders.markBillPaid(billId, new Date().toISOString())
      await fetchBillReminders()
      notifyBillsChanged()
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

  const openEditDialog = (bill: BillReminder) => {
    setBillForm({
      name: bill.name,
      amount: String(bill.amount),
      dueDate: format(new Date(bill.dueDate), 'yyyy-MM-dd'),
      frequency: bill.frequency,
      category: bill.category,
      description: bill.description || '',
      reminderDays: [...bill.reminderDays],
      autoPayEnabled: bill.autoPayEnabled
    })
    setAmountError(null)
    setEditingBill(bill)
  }

  const toggleReminderDay = (day: number) => {
    setBillForm(prev => ({
      ...prev,
      reminderDays: prev.reminderDays.includes(day)
        ? prev.reminderDays.filter(d => d !== day)
        : [...prev.reminderDays, day].sort((a, b) => b - a)
    }))
  }

  const getVisibleBills = () => {
    const today = startOfDay(new Date())

    let filtered: BillReminder[]
    switch (filterStatus) {
      case 'upcoming':
        filtered = bills.filter(bill => !bill.isPaid && !isBefore(startOfDay(new Date(bill.dueDate)), today))
        break
      case 'overdue':
        filtered = bills.filter(bill => !bill.isPaid && isBefore(startOfDay(new Date(bill.dueDate)), today))
        break
      case 'paid':
        filtered = bills.filter(bill => bill.isPaid)
        break
      default:
        filtered = [...bills]
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.amount - a.amount
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
    })

    return filtered
  }

  const getBillStatusText = (bill: BillReminder) => {
    if (bill.isPaid) return 'Paid'

    const daysUntilDue = differenceInCalendarDays(new Date(bill.dueDate), new Date())

    if (daysUntilDue < 0) return `Overdue by ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'}`
    if (daysUntilDue === 0) return 'Due today'
    if (daysUntilDue === 1) return 'Due tomorrow'
    return `Due in ${daysUntilDue} days`
  }

  const getNextDueDate = (bill: BillReminder) => {
    const dueDate = new Date(bill.dueDate)
    const today = startOfDay(new Date())

    if (bill.frequency === 'one-time' || !isBefore(startOfDay(dueDate), today)) {
      return dueDate
    }

    // Roll the stored due date forward by whole periods until it lands today
    // or later (display only)
    let next = dueDate
    while (isBefore(startOfDay(next), today)) {
      switch (bill.frequency) {
        case 'weekly':
          next = addWeeks(next, 1)
          break
        case 'monthly':
          next = addMonths(next, 1)
          break
        case 'quarterly':
          next = addQuarters(next, 1)
          break
        case 'yearly':
          next = addYears(next, 1)
          break
        default:
          return next
      }
    }

    return next
  }

  const renderBillFormFields = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-1">
          <Label htmlFor="billName" className="text-sm md:text-base">Bill Name</Label>
          <Input
            id="billName"
            value={billForm.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBillForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Electric bill, rent, etc."
            className="mt-1 md:mt-2"
          />
        </div>
        <div className="md:col-span-1">
          <Label htmlFor="billAmount" className="text-sm md:text-base">Amount</Label>
          <Input
            id="billAmount"
            type="number"
            value={billForm.amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setBillForm(prev => ({ ...prev, amount: e.target.value }))
              setAmountError(null)
            }}
            placeholder="0.00"
            className="mt-1 md:mt-2"
          />
          {amountError && (
            <p className="text-xs text-red-400 mt-1">{amountError}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm md:text-base">Category</Label>
          <Select
            value={billForm.category}
            onValueChange={(value) => setBillForm(prev => ({ ...prev, category: value }))}
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
            value={billForm.frequency}
            onValueChange={(value: BillReminder['frequency']) => setBillForm(prev => ({ ...prev, frequency: value }))}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="billDueDate" className="text-sm md:text-base">Due Date</Label>
          <Input
            id="billDueDate"
            type="date"
            value={billForm.dueDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBillForm(prev => ({ ...prev, dueDate: e.target.value }))}
            className="mt-1 md:mt-2"
          />
        </div>
        <div>
          <Label className="text-sm md:text-base">Remind me</Label>
          <div className="flex gap-2 mt-1 md:mt-2">
            {REMINDER_DAY_OPTIONS.map((day) => {
              const selected = billForm.reminderDays.includes(day)
              return (
                <Button
                  key={day}
                  type="button"
                  onClick={() => toggleReminderDay(day)}
                  className={selected
                    ? "bg-cream/20 hover:bg-cream/25 text-cream border border-cream/30 px-2.5 py-1.5 text-xs h-auto"
                    : "bg-cream/5 hover:bg-cream/10 text-cream/50 border border-cream/10 px-2.5 py-1.5 text-xs h-auto"}
                >
                  {day === 1 ? '1 day' : `${day} days`}
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-cream/10 bg-cream/5 px-3 py-2.5">
        <div>
          <Label htmlFor="billAutoPay" className="text-sm md:text-base cursor-pointer">Auto-pay</Label>
          <p className="text-xs text-cream/50">This bill is paid automatically</p>
        </div>
        <Switch
          id="billAutoPay"
          checked={billForm.autoPayEnabled}
          onCheckedChange={(checked: boolean) => setBillForm(prev => ({ ...prev, autoPayEnabled: checked }))}
        />
      </div>
    </>
  )

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

  const visibleBills = getVisibleBills()

  return (
    <div className="w-full max-w-full overflow-hidden h-full flex flex-col">
      <div className="flex-1 space-y-2 md:space-y-3 min-h-0">
        {/* Compact Header */}
        {(!hideInternalFilters || !hideInternalAddButton) && (
          <div className="flex items-center justify-between gap-2">
            {!hideInternalFilters && (
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
                    onClick={() => setInternalFilterStatus("all")}
                  >
                    All Bills
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-cream hover:bg-cream/10 cursor-pointer text-xs"
                    onClick={() => setInternalFilterStatus("upcoming")}
                  >
                    Upcoming
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-cream hover:bg-cream/10 cursor-pointer text-xs"
                    onClick={() => setInternalFilterStatus("overdue")}
                  >
                    Overdue
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-cream hover:bg-cream/10 cursor-pointer text-xs"
                    onClick={() => setInternalFilterStatus("paid")}
                  >
                    Paid
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!hideInternalAddButton && (
              <Button
                onClick={() => setShowCreateBill(true)}
                className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 px-2 py-1 text-xs h-auto ml-auto"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

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
              {visibleBills.slice(0, limit).map((bill) => {
                const categoryInfo = billCategories.find(c => c.value === bill.category)
                const nextDueDate = getNextDueDate(bill)
                const IconComponent = categoryInfo?.icon || FileText

                return (
                  <MotionDiv
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

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-medium text-cream/90 text-xs">${bill.amount.toFixed(0)}</div>
                            <div className="text-xs text-cream/50 whitespace-nowrap">
                              {getBillStatusText(bill)}
                            </div>
                          </div>

                          {!bill.isPaid && (
                            <Button
                              size="sm"
                              onClick={() => markBillAsPaid(bill.id)}
                              className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 px-1.5 py-1 text-xs h-auto"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(bill)}
                            className="h-6 w-6 text-cream/60 hover:text-cream hover:bg-cream/10"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setBillToDelete(bill)}
                            className="h-6 w-6 text-cream/60 hover:text-red-400 hover:bg-cream/10"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </MotionDiv>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Compact Empty State */}
        {visibleBills.length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center text-center py-4">
            <div>
              <Bell className="h-6 w-6 text-cream/40 mx-auto mb-2" />
              <p className="text-xs text-cream/60 mb-2">
                {filterStatus === 'all' ? "No bills yet" : `No ${filterStatus} bills`}
              </p>
              {filterStatus === 'all' && !hideInternalAddButton && (
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

      {/* Add Bill Dialog */}
      <Dialog open={showCreateBill} onOpenChange={setShowCreateBill}>
        <DialogContent className="mx-4 sm:mx-0 md:mx-auto sm:max-w-md md:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Add Bill Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 md:space-y-5">
            {renderBillFormFields()}

            <Button
              onClick={createBillReminder}
              className="w-full mt-6"
              disabled={!billForm.name || !billForm.amount || !billForm.dueDate}
            >
              Add Bill Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Bill Dialog */}
      <Dialog open={!!editingBill} onOpenChange={(open) => { if (!open) setEditingBill(null) }}>
        <DialogContent className="mx-4 sm:mx-0 md:mx-auto sm:max-w-md md:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Edit Bill Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 md:space-y-5">
            {renderBillFormFields()}

            <Button
              onClick={updateBillReminder}
              className="w-full mt-6"
              disabled={!billForm.name || !billForm.amount || !billForm.dueDate}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!billToDelete} onOpenChange={(open) => !open && setBillToDelete(null)}>
        <AlertDialogContent className="bg-dark border-cream/10 text-cream w-[95vw] max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Delete Bill Reminder</AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 text-sm">
              Are you sure you want to delete &quot;{billToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteBillReminder}
              className="bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
