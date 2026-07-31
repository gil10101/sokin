"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { format, addMonths, addDays, addYears } from "date-fns"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit,
  ExternalLink,
  Search,
  SortAsc,
  SortDesc,
  Plus,
} from "lucide-react"
import { AddButton } from "@/components/ui/add-button"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MotionContainer } from "@/components/ui/motion-container"
import { subscriptionsAPI } from "@/lib/api"
import { useCurrency } from "@/hooks/use-currency"

// Define subscription interface
interface Subscription {
  id: string
  name: string
  amount: number
  billingCycle: "monthly" | "quarterly" | "semi-annually" | "annually" | "custom"
  customInterval?: number
  customIntervalUnit?: "days" | "weeks" | "months" | "years"
  startDate: string
  nextPaymentDate: string
  paymentMethod: string
  website?: string | null
  notes?: string | null
  autoRenew: boolean
  category: string
  userId: string
  createdAt: string
  updatedAt?: string
}

// Define projected payment interface
interface ProjectedPayment {
  id: string
  subscriptionId: string
  date: string
  amount: number
  paymentMethod: string
}

// Payload sent to the API when creating or updating a subscription
type SubscriptionPayload = Omit<Subscription, "id" | "userId" | "createdAt" | "updatedAt">

// Form state for adding/editing a subscription
interface SubscriptionFormData {
  name: string
  amount: string
  billingCycle: Subscription["billingCycle"]
  customInterval: string
  customIntervalUnit: "days" | "weeks" | "months" | "years"
  startDate: Date
  paymentMethod: string
  website: string
  notes: string
  autoRenew: boolean
  category: string
}

// Default categories
const SUBSCRIPTION_CATEGORIES = [
  "Entertainment",
  "Productivity",
  "Utilities",
  "Health & Fitness",
  "Education",
  "News & Media",
  "Shopping",
  "Software",
  "Gaming",
  "Music",
  "Other",
]

// Default payment methods
const PAYMENT_METHODS = ["Credit Card", "Debit Card", "PayPal", "Bank Transfer", "Apple Pay", "Google Pay", "Other"]

// Helper function to safely parse dates
const safeParseDate = (dateValue: unknown): Date => {
  if (!dateValue) return new Date()
  
  try {
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue
    }
    // If it's a Firebase Timestamp object
    else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue && typeof dateValue.toDate === 'function') {
      return (dateValue as { toDate(): Date }).toDate()
    }
    // If it's a numeric timestamp (milliseconds)
    else if (typeof dateValue === 'number') {
      return new Date(dateValue)
    }
    // If it's a string
    else if (typeof dateValue === 'string') {
      const parsedDate = new Date(dateValue)
      return isNaN(parsedDate.getTime()) ? new Date() : parsedDate
    }
    
    return new Date()
  } catch (error) {
    return new Date()
  }
}

// Advance a date by one billing cycle. Returns the same date if the cycle
// cannot advance (unknown cycle or invalid custom interval) so callers can bail out.
const advanceByBillingCycle = (
  date: Date,
  billingCycle: string,
  customInterval?: number,
  customIntervalUnit?: string,
): Date => {
  switch (billingCycle) {
    case "monthly":
      return addMonths(date, 1)
    case "quarterly":
      return addMonths(date, 3)
    case "semi-annually":
      return addMonths(date, 6)
    case "annually":
      return addYears(date, 1)
    case "custom":
      if (customInterval && customInterval > 0 && customIntervalUnit) {
        switch (customIntervalUnit) {
          case "days":
            return addDays(date, customInterval)
          case "weeks":
            return addDays(date, customInterval * 7)
          case "months":
            return addMonths(date, customInterval)
          case "years":
            return addYears(date, customInterval)
        }
      }
      return date
    default:
      return date
  }
}

// Generate upcoming projected payments from the subscription's next payment date
const generateProjectedPayments = (subscription: Subscription): ProjectedPayment[] => {
  const projected: ProjectedPayment[] = []
  let currentDate = safeParseDate(subscription.nextPaymentDate)

  while (projected.length < 6) {
    projected.push({
      id: `payment-${subscription.id}-${currentDate.getTime()}`,
      subscriptionId: subscription.id,
      date: currentDate.toISOString(),
      amount: subscription.amount,
      paymentMethod: subscription.paymentMethod,
    })

    const nextDate = advanceByBillingCycle(
      currentDate,
      subscription.billingCycle,
      subscription.customInterval,
      subscription.customIntervalUnit,
    )

    // Guard against cycles that never advance
    if (nextDate <= currentDate) break
    currentDate = nextDate
  }

  return projected
}

// Calculate next payment date based on billing cycle
const calculateNextPaymentDate = (
  startDate: Date,
  billingCycle: string,
  customInterval?: number,
  customIntervalUnit?: string,
): Date => {
  const now = new Date()
  let nextDate = new Date(safeParseDate(startDate))

  // Find the next payment date after today
  while (nextDate <= now) {
    const advanced = advanceByBillingCycle(nextDate, billingCycle, customInterval, customIntervalUnit)

    // Guard against cycles that never advance
    if (advanced <= nextDate) break
    nextDate = advanced
  }

  return nextDate
}

// Format billing cycle for display
const formatBillingCycle = (billingCycle: string, customInterval?: number, customIntervalUnit?: string): string => {
  switch (billingCycle) {
    case "monthly":
      return "Monthly"
    case "quarterly":
      return "Quarterly"
    case "semi-annually":
      return "Semi-annually"
    case "annually":
      return "Annually"
    case "custom":
      if (customInterval && customIntervalUnit) {
        return `Every ${customInterval} ${customIntervalUnit}`
      }
      return "Custom"
    default:
      return billingCycle
  }
}

// Calculate annual cost
const calculateAnnualCost = (
  amount: number,
  billingCycle: string,
  customInterval?: number,
  customIntervalUnit?: string,
): number => {
  switch (billingCycle) {
    case "monthly":
      return amount * 12
    case "quarterly":
      return amount * 4
    case "semi-annually":
      return amount * 2
    case "annually":
      return amount
    case "custom":
      if (customInterval && customInterval > 0 && customIntervalUnit) {
        // Convert the cycle length into payments per year
        switch (customIntervalUnit) {
          case "days":
            return amount * (365 / customInterval)
          case "weeks":
            return amount * (365 / (customInterval * 7))
          case "months":
            return amount * (12 / customInterval)
          case "years":
            return amount / customInterval
        }
      }
      return amount
    default:
      return amount
  }
}

interface SubscriptionsPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function SubscriptionsPage(props: SubscriptionsPageProps) {
  const { format: formatCurrency } = useCurrency()
  const { user } = useAuth()
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Record<string, boolean>>({})
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<string | null>(null)
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<string>("nextPaymentDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [projectedPayments, setProjectedPayments] = useState<Record<string, ProjectedPayment[]>>({})
  const [mounted, setMounted] = useState(false)

  // Form state for adding/editing subscription
  const [formData, setFormData] = useState<SubscriptionFormData>({
    name: "",
    amount: "",
    billingCycle: "monthly",
    customInterval: "",
    customIntervalUnit: "months",
    startDate: new Date(),
    paymentMethod: "Credit Card",
    website: "",
    notes: "",
    autoRenew: true,
    category: "Entertainment",
  })

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter and sort subscriptions when data changes
  useEffect(() => {
    let result = [...subscriptions]

    // Apply search filter
    if (searchQuery) {
      result = result.filter(
        (subscription) =>
          subscription.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          subscription.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          subscription.notes?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply category filter
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((subscription) => subscription.category === categoryFilter)
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison: number

      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "amount":
          comparison = a.amount - b.amount
          break
        case "billingCycle":
          comparison = a.billingCycle.localeCompare(b.billingCycle)
          break
        case "category":
          comparison = a.category.localeCompare(b.category)
          break
        case "nextPaymentDate":
        default:
          comparison = safeParseDate(a.nextPaymentDate).getTime() - safeParseDate(b.nextPaymentDate).getTime()
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    setFilteredSubscriptions(result)
  }, [subscriptions, searchQuery, categoryFilter, sortBy, sortDirection])

  // Fetch subscriptions from API
  const fetchSubscriptions = useCallback(async () => {
    if (!userRef.current) return

    setLoading(true)
    try {
      const subscriptionsData = await subscriptionsAPI.getSubscriptions()

      // Normalize API data: drop any records without an id
      const normalizedSubscriptions = subscriptionsData.filter(
        (subscription): subscription is Subscription => Boolean(subscription.id),
      )

      setSubscriptions(normalizedSubscriptions)

      // Generate projected payments for each subscription
      const projected: Record<string, ProjectedPayment[]> = {}
      normalizedSubscriptions.forEach((subscription) => {
        projected[subscription.id] = generateProjectedPayments(subscription)
      })
      setProjectedPayments(projected)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error loading your subscriptions"
      toast({
        title: "Error loading subscriptions",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch subscriptions when user is available
  useEffect(() => {
    if (user && mounted) {
      fetchSubscriptions()
    }
  }, [user, mounted])

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Handle date changes
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, startDate: date }))
    }
  }

  // Handle checkbox changes
  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  // Reset form data
  const resetForm = () => {
    setFormData({
      name: "",
      amount: "",
      billingCycle: "monthly",
      customInterval: "",
      customIntervalUnit: "months",
      startDate: new Date(),
      paymentMethod: "Credit Card",
      website: "",
      notes: "",
      autoRenew: true,
      category: "Entertainment",
    })
  }

  // Toggle subscription details
  const toggleSubscriptionDetails = (id: string) => {
    setExpandedSubscriptions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to manage subscriptions",
        variant: "destructive",
      })
      return
    }

    if (!formData.name || !formData.amount || !formData.billingCycle || !formData.startDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // Validate custom interval if billing cycle is custom
    const parsedCustomInterval =
      formData.billingCycle === "custom" ? Number.parseInt(formData.customInterval) : undefined

    if (
      formData.billingCycle === "custom" &&
      (!parsedCustomInterval || parsedCustomInterval < 0 || !formData.customIntervalUnit)
    ) {
      toast({
        title: "Missing custom interval",
        description: "Please specify a custom billing interval greater than zero",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // Calculate next payment date
      const nextPaymentDate = calculateNextPaymentDate(
        formData.startDate,
        formData.billingCycle,
        parsedCustomInterval,
        formData.customIntervalUnit,
      )

      // Prepare subscription data
      const subscriptionData: SubscriptionPayload = {
        name: formData.name,
        amount: Number.parseFloat(formData.amount),
        billingCycle: formData.billingCycle,
        startDate: formData.startDate.toISOString(),
        nextPaymentDate: nextPaymentDate.toISOString(),
        paymentMethod: formData.paymentMethod,
        website: formData.website || "",
        notes: formData.notes || "",
        autoRenew: formData.autoRenew,
        category: formData.category,
      }

      // Only include custom interval fields if billing cycle is custom
      if (formData.billingCycle === "custom") {
        subscriptionData.customInterval = parsedCustomInterval
        subscriptionData.customIntervalUnit = formData.customIntervalUnit
      }

      if (editingSubscriptionId) {
        await subscriptionsAPI.updateSubscription(editingSubscriptionId, subscriptionData)
      } else {
        await subscriptionsAPI.createSubscription(subscriptionData)
      }

      toast({
        title: editingSubscriptionId ? "Subscription updated" : "Subscription added",
        description: editingSubscriptionId
          ? "Your subscription has been updated successfully"
          : "Your subscription has been added successfully",
      })

      // Reset form and close dialog
      resetForm()
      setEditingSubscriptionId(null)
      setOpenDialog(false)

      // Refresh the list and any dashboard data built from it
      await fetchSubscriptions()
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error saving your subscription"
      toast({
        title: editingSubscriptionId ? "Error updating subscription" : "Error adding subscription",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Open the dialog prefilled with an existing subscription
  const handleEditSubscription = (subscription: Subscription) => {
    setFormData({
      name: subscription.name,
      amount: subscription.amount.toString(),
      billingCycle: subscription.billingCycle,
      customInterval: subscription.customInterval ? subscription.customInterval.toString() : "",
      customIntervalUnit: subscription.customIntervalUnit || "months",
      startDate: safeParseDate(subscription.startDate),
      paymentMethod: subscription.paymentMethod,
      website: subscription.website || "",
      notes: subscription.notes || "",
      autoRenew: subscription.autoRenew,
      category: subscription.category,
    })
    setEditingSubscriptionId(subscription.id)
    setOpenDialog(true)
  }

  // Handle subscription deletion
  const handleDeleteSubscription = async () => {
    const subscriptionId = subscriptionToDelete
    if (!subscriptionId) return

    try {
      await subscriptionsAPI.deleteSubscription(subscriptionId)

      // Update local state
      setSubscriptions((prev) => prev.filter((subscription) => subscription.id !== subscriptionId))

      // Remove from expanded subscriptions
      const { [subscriptionId]: _, ...rest } = expandedSubscriptions
      setExpandedSubscriptions(rest)

      // Remove projected payments
      const { [subscriptionId]: __, ...restProjected } = projectedPayments
      setProjectedPayments(restProjected)

      // Refresh any dashboard data built from subscriptions
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })

      toast({
        title: "Subscription deleted",
        description: "The subscription has been deleted successfully",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error deleting the subscription"
      toast({
        title: "Error deleting subscription",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSubscriptionToDelete(null)
    }
  }

  // Calculate total monthly and annual costs across all subscriptions
  const calculateTotalCosts = () => {
    let monthlyTotal = 0
    let annualTotal = 0

    subscriptions.forEach((subscription) => {
      const annualCost = calculateAnnualCost(
        subscription.amount,
        subscription.billingCycle,
        subscription.customInterval,
        subscription.customIntervalUnit,
      )

      annualTotal += annualCost
      monthlyTotal += annualCost / 12
    })

    return { monthlyTotal, annualTotal }
  }

  const { monthlyTotal, annualTotal } = calculateTotalCosts()

  // Get unique categories from subscriptions
  const getUniqueCategories = () => {
    const categories = new Set<string>()
    subscriptions.forEach((subscription) => {
      categories.add(subscription.category)
    })
    return Array.from(categories)
  }

  const uniqueCategories = getUniqueCategories()

  if (!mounted) {
    return (
      <div className="flex flex-1 items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-medium font-outfit">Subscriptions</h1>
              <p className="text-cream/60 text-sm mt-1 font-outfit">Manage your recurring subscriptions and services</p>
            </div>
            <AddButton
              label="Subscription"
              onClick={() => setOpenDialog(true)}
            />
          </div>

          <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6 mb-8">
            <div className="flex flex-col gap-4 sm:gap-6 mb-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-medium">Overview</h3>
                <div className="grid grid-cols-3 gap-4 sm:flex sm:gap-0">
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left sm:w-32 sm:pr-6 sm:border-r sm:border-cream/10">
                    <p className="text-xs sm:text-sm text-cream/60">Monthly Cost</p>
                    <p className="text-lg sm:text-xl font-medium mt-1">{formatCurrency(monthlyTotal)}</p>
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left sm:w-32 sm:border-r sm:border-cream/10">
                    <p className="text-xs sm:text-sm text-cream/60">Annual Cost</p>
                    <p className="text-lg sm:text-xl font-medium mt-1">{formatCurrency(annualTotal)}</p>
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left sm:w-32 sm:pl-6">
                    <p className="text-xs sm:text-sm text-cream/60">Subscriptions</p>
                    <p className="text-lg sm:text-xl font-medium mt-1">{subscriptions.length}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/40" />
                  <Input
                    placeholder="Search subscriptions..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[140px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark border-cream/10">
                      <SelectItem value="all" className="text-cream hover:bg-cream/10">
                        All Categories
                      </SelectItem>
                      {uniqueCategories.map((category) => (
                        <SelectItem key={category} value={category} className="text-cream hover:bg-cream/10">
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                      className="h-10 w-10 bg-cream/5 border-cream/10 text-cream hover:bg-cream/10"
                    >
                      {sortDirection === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                    </Button>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="flex-1 sm:w-[140px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent className="bg-dark border-cream/10">
                        <SelectItem value="name" className="text-cream hover:bg-cream/10">
                          Name
                        </SelectItem>
                        <SelectItem value="amount" className="text-cream hover:bg-cream/10">
                          Amount
                        </SelectItem>
                        <SelectItem value="nextPaymentDate" className="text-cream hover:bg-cream/10">
                          Next Payment
                        </SelectItem>
                        <SelectItem value="billingCycle" className="text-cream hover:bg-cream/10">
                          Billing Cycle
                        </SelectItem>
                        <SelectItem value="category" className="text-cream hover:bg-cream/10">
                          Category
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 sm:py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredSubscriptions.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <p className="text-cream/60 mb-4 text-sm sm:text-base">No subscriptions found</p>
                <Button
                  onClick={() => setOpenDialog(true)}
                  variant="outline"
                  className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Subscription
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 border-b border-cream/10 pb-2">
                  <div className="col-span-3 text-sm font-medium text-cream/60 px-4">Subscription</div>
                  <div className="col-span-2 text-sm font-medium text-cream/60 text-center border-l border-cream/10 px-2">Billing Cycle</div>
                  <div className="col-span-3 text-sm font-medium text-cream/60 text-center border-l border-cream/10 px-2">Next Payment</div>
                  <div className="col-span-2 text-sm font-medium text-cream/60 text-center border-l border-cream/10 px-2">Payment Method</div>
                  <div className="col-span-2 text-sm font-medium text-cream/60 text-center border-l border-cream/10 px-2">Amount</div>
                </div>

                {filteredSubscriptions.map((subscription) => (
                  <Collapsible
                    key={subscription.id}
                    open={expandedSubscriptions[subscription.id]}
                    onOpenChange={() => toggleSubscriptionDetails(subscription.id)}
                    className="border border-cream/10 rounded-lg overflow-hidden"
                  >
                    <div className="bg-cream/5 hover:bg-cream/10 transition-colors p-4">
                      {/* Mobile and tablet layout */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-md bg-cream/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <span className="text-sm sm:text-lg font-medium">{subscription.name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-sm sm:text-base truncate">{subscription.name}</h3>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-xs sm:text-sm text-cream/60">
                                  <span>{subscription.category}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="sm:hidden">
                                    {formatBillingCycle(
                                      subscription.billingCycle,
                                      subscription.customInterval,
                                      subscription.customIntervalUnit,
                                    )}
                                  </span>
                                  <span className="hidden sm:inline">
                                    {formatBillingCycle(
                                      subscription.billingCycle,
                                      subscription.customInterval,
                                      subscription.customIntervalUnit,
                                    )}
                                  </span>
                                </div>
                                <p className="text-xs text-cream/60 sm:hidden mt-1">
                                  Next: {format(safeParseDate(subscription.nextPaymentDate), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-medium text-sm sm:text-base">{formatCurrency(subscription.amount)}</p>
                              <p className="text-xs text-cream/60 hidden sm:block">
                                Next: {format(safeParseDate(subscription.nextPaymentDate), "MMM d")}
                              </p>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10 flex-shrink-0"
                              >
                                {expandedSubscriptions[subscription.id] ? (
                                  <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="p-4 bg-cream/5 border-t border-cream/10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                          <div>
                            <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Subscription Details</h4>
                            <div className="space-y-2 sm:space-y-3">
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs sm:text-sm text-cream/60">Start Date</p>
                                <p className="text-xs sm:text-sm text-right">{format(safeParseDate(subscription.startDate), "MMM d, yyyy")}</p>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs sm:text-sm text-cream/60">Next Payment</p>
                                <p className="text-xs sm:text-sm text-right">
                                  {format(safeParseDate(subscription.nextPaymentDate), "MMM d, yyyy")}
                                </p>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs sm:text-sm text-cream/60">Billing Cycle</p>
                                <p className="text-xs sm:text-sm text-right">
                                  {formatBillingCycle(
                                    subscription.billingCycle,
                                    subscription.customInterval,
                                    subscription.customIntervalUnit,
                                  )}
                                </p>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs sm:text-sm text-cream/60">Payment Method</p>
                                <p className="text-xs sm:text-sm text-right">{subscription.paymentMethod}</p>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs sm:text-sm text-cream/60">Auto-Renew</p>
                                <p className="text-xs sm:text-sm text-right">{subscription.autoRenew ? "Yes" : "No"}</p>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs sm:text-sm text-cream/60">Amount per Cycle</p>
                                <p className="text-xs sm:text-sm font-medium text-right">{formatCurrency(subscription.amount)}</p>
                              </div>
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs sm:text-sm text-cream/60">Annual Cost</p>
                                <p className="text-xs sm:text-sm font-medium text-right">
                                  $
                                  {formatCurrency(calculateAnnualCost(
                                    subscription.amount,
                                    subscription.billingCycle,
                                    subscription.customInterval,
                                    subscription.customIntervalUnit,
                                  ))}
                                </p>
                              </div>
                              {subscription.website && (
                                <div className="flex justify-between items-start gap-2">
                                  <p className="text-xs sm:text-sm text-cream/60">Website</p>
                                  <a
                                    href={subscription.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs sm:text-sm text-cream flex items-center hover:underline"
                                  >
                                    Visit Site
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              {subscription.notes && (
                                <div className="pt-2 border-t border-cream/10">
                                  <p className="text-xs sm:text-sm text-cream/60 mb-1">Notes</p>
                                  <p className="text-xs sm:text-sm">{subscription.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base">Projected Payments</h4>
                            {projectedPayments[subscription.id] && projectedPayments[subscription.id].length > 0 ? (
                              <div className="space-y-2 sm:space-y-3">
                                <div className="hidden sm:block overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-cream/10 hover:bg-transparent">
                                        <TableHead className="text-cream/60 text-xs">Date</TableHead>
                                        <TableHead className="text-cream/60 text-xs">Amount</TableHead>
                                        <TableHead className="text-cream/60 text-xs">Method</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {projectedPayments[subscription.id].map((payment) => (
                                        <TableRow key={payment.id} className="border-cream/10">
                                          <TableCell className="text-xs">{format(safeParseDate(payment.date), "MMM d, yyyy")}</TableCell>
                                          <TableCell className="text-xs">{formatCurrency(payment.amount)}</TableCell>
                                          <TableCell className="text-xs">{payment.paymentMethod}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Mobile projected payments layout */}
                                <div className="block sm:hidden space-y-2">
                                  {projectedPayments[subscription.id].slice(0, 3).map((payment) => (
                                    <div key={payment.id} className="bg-cream/10 rounded-lg p-3 space-y-1">
                                      <div className="flex justify-between items-start">
                                        <span className="text-xs text-cream/60">{format(safeParseDate(payment.date), "MMM d, yyyy")}</span>
                                        <span className="text-xs font-medium">{formatCurrency(payment.amount)}</span>
                                      </div>
                                      <p className="text-xs text-cream/60">{payment.paymentMethod}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs sm:text-sm text-cream/60">No projected payments available</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end mt-4 sm:mt-6 gap-2">
                          <Button
                            variant="outline"
                            className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 w-full sm:w-auto"
                            onClick={() => handleEditSubscription(subscription)}
                          >
                            <Edit className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="bg-transparent border-red-500/20 text-red-400 hover:bg-red-500/10 w-full sm:w-auto"
                            onClick={() => setSubscriptionToDelete(subscription.id)}
                          >
                            <Trash2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </MotionContainer>
        </div>
      </main>

      <Dialog
        open={openDialog}
        onOpenChange={(open) => {
          setOpenDialog(open)
          if (!open) {
            resetForm()
            setEditingSubscriptionId(null)
          }
        }}
      >
        <DialogContent className="bg-dark border-cream/10 text-cream w-[95vw] max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {editingSubscriptionId ? "Edit Subscription" : "Add New Subscription"}
            </DialogTitle>
            <DialogDescription className="text-cream/60 text-sm sm:text-base">
              {editingSubscriptionId
                ? "Update the details of your subscription."
                : "Add details about your subscription to track payments and renewals."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-outfit block">
                  Subscription Name *
                </label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Netflix, Spotify, etc."
                  required
                  className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="amount" className="text-sm font-outfit block">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/60">$</span>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-outfit block">Billing Cycle *</label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(value) => handleSelectChange("billingCycle", value)}
                  required
                >
                  <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                    <SelectValue placeholder="Select billing cycle" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark border-cream/10">
                    <SelectItem value="monthly" className="text-cream hover:bg-cream/10">
                      Monthly
                    </SelectItem>
                    <SelectItem value="quarterly" className="text-cream hover:bg-cream/10">
                      Quarterly
                    </SelectItem>
                    <SelectItem value="semi-annually" className="text-cream hover:bg-cream/10">
                      Semi-Annually
                    </SelectItem>
                    <SelectItem value="annually" className="text-cream hover:bg-cream/10">
                      Annually
                    </SelectItem>
                    <SelectItem value="custom" className="text-cream hover:bg-cream/10">
                      Custom
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.billingCycle === "custom" && (
                <div className="space-y-2">
                  <label className="text-sm font-outfit block">Custom Interval *</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        id="customInterval"
                        name="customInterval"
                        type="number"
                        value={formData.customInterval}
                        onChange={handleInputChange}
                        placeholder="1, 2, 3, etc."
                        min="1"
                        required
                        className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                      />
                    </div>

                    <div className="flex-1">
                      <Select
                        value={formData.customIntervalUnit}
                        onValueChange={(value) => handleSelectChange("customIntervalUnit", value)}
                        required
                      >
                        <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent className="bg-dark border-cream/10">
                          <SelectItem value="days" className="text-cream hover:bg-cream/10">
                            Days
                          </SelectItem>
                          <SelectItem value="weeks" className="text-cream hover:bg-cream/10">
                            Weeks
                          </SelectItem>
                          <SelectItem value="months" className="text-cream hover:bg-cream/10">
                            Months
                          </SelectItem>
                          <SelectItem value="years" className="text-cream hover:bg-cream/10">
                            Years
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-outfit block">Start Date *</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-cream/5 border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.startDate ? format(formData.startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-dark border-cream/10" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={handleDateChange}
                      initialFocus
                      className="bg-dark text-cream"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-outfit block">Payment Method *</label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => handleSelectChange("paymentMethod", value)}
                  required
                >
                  <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark border-cream/10">
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method} className="text-cream hover:bg-cream/10">
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="website" className="text-sm font-outfit block">
                  Website (Optional)
                </label>
                <Input
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://example.com"
                  className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-outfit block">Category *</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleSelectChange("category", value)}
                  required
                >
                  <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark border-cream/10">
                    {SUBSCRIPTION_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category} className="text-cream hover:bg-cream/10">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-outfit block">
                Notes (Optional)
              </label>
              <Input
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Additional details about this subscription"
                className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoRenew"
                checked={formData.autoRenew}
                onChange={(e) => handleCheckboxChange("autoRenew", e.target.checked)}
                className="h-4 w-4 rounded border-cream/10 bg-cream/5 text-cream focus:ring-cream/20"
              />
              <label htmlFor="autoRenew" className="text-sm font-outfit">
                Auto-renew subscription
              </label>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm()
                  setEditingSubscriptionId(null)
                  setOpenDialog(false)
                }}
                className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-cream text-dark hover:bg-cream/90 font-medium w-full sm:w-auto">
                {loading ? "Saving..." : editingSubscriptionId ? "Save Changes" : "Add Subscription"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!subscriptionToDelete} onOpenChange={(open) => !open && setSubscriptionToDelete(null)}>
        <AlertDialogContent className="bg-dark border-cream/10 text-cream w-[95vw] max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60 text-sm">
              Are you sure you want to delete this subscription? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubscription} className="bg-red-500 text-white hover:bg-red-600 w-full sm:w-auto">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

