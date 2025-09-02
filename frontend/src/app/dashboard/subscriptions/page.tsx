"use client"

import { AlertDialogTrigger } from "../../../components/ui/alert-dialog"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { collection, query, where, orderBy, getDocs, addDoc, doc, deleteDoc } from "firebase/firestore"
import { db } from "../../../lib/firebase"
import { useAuth } from "../../../contexts/auth-context"
import { format, addMonths, addDays, addYears } from "date-fns"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { PageHeader } from "../../../components/dashboard/page-header"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Calendar } from "../../../components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import {
  Plus,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit,
  ExternalLink,
  Search,
  SortAsc,
  SortDesc,
} from "lucide-react"
import { useToast } from "../../../hooks/use-toast"
import { LoadingSpinner } from "../../../components/ui/loading-spinner"
import { MotionContainer } from "../../../components/ui/motion-container"

// Define subscription interface
interface Subscription {
  id: string
  name: string
  logo?: string
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
  updatedAt: string
}

// Define payment history interface
interface PaymentHistory {
  id: string
  subscriptionId: string
  date: string
  amount: number
  status: "paid" | "pending" | "failed"
  paymentMethod: string
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

// Mock logos for popular services
const SERVICE_LOGOS: Record<string, string> = {
  Netflix: "/placeholder.svg?height=40&width=40&text=N",
  Spotify: "/placeholder.svg?height=40&width=40&text=S",
  "Amazon Prime": "/placeholder.svg?height=40&width=40&text=A",
  "Disney+": "/placeholder.svg?height=40&width=40&text=D",
  "YouTube Premium": "/placeholder.svg?height=40&width=40&text=Y",
  "Apple Music": "/placeholder.svg?height=40&width=40&text=AM",
  "Microsoft 365": "/placeholder.svg?height=40&width=40&text=M",
  "Adobe Creative Cloud": "/placeholder.svg?height=40&width=40&text=A",
  "HBO Max": "/placeholder.svg?height=40&width=40&text=H",
  Hulu: "/placeholder.svg?height=40&width=40&text=H",
}

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

// Generate payment history from subscription data
const generatePaymentHistory = (subscription: Subscription): PaymentHistory[] => {
  const history: PaymentHistory[] = []
  const startDate = safeParseDate(subscription.startDate)
  const now = new Date()
  let currentDate = new Date(startDate)

  while (currentDate <= now) {
    history.push({
      id: `payment-${subscription.id}-${currentDate.getTime()}`,
      subscriptionId: subscription.id,
      date: currentDate.toISOString(),
      amount: subscription.amount,
      status: "paid",
      paymentMethod: subscription.paymentMethod,
    })

    // Advance to next payment date based on billing cycle
    switch (subscription.billingCycle) {
      case "monthly":
        currentDate = addMonths(currentDate, 1)
        break
      case "quarterly":
        currentDate = addMonths(currentDate, 3)
        break
      case "semi-annually":
        currentDate = addMonths(currentDate, 6)
        break
      case "annually":
        currentDate = addYears(currentDate, 1)
        break
      case "custom":
        if (subscription.customInterval && subscription.customIntervalUnit) {
          switch (subscription.customIntervalUnit) {
            case "days":
              currentDate = addDays(currentDate, subscription.customInterval)
              break
            case "weeks":
              currentDate = addDays(currentDate, subscription.customInterval * 7)
              break
            case "months":
              currentDate = addMonths(currentDate, subscription.customInterval)
              break
            case "years":
              currentDate = addYears(currentDate, subscription.customInterval)
              break
          }
        }
        break
    }
  }

  return history
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
    switch (billingCycle) {
      case "monthly":
        nextDate = addMonths(nextDate, 1)
        break
      case "quarterly":
        nextDate = addMonths(nextDate, 3)
        break
      case "semi-annually":
        nextDate = addMonths(nextDate, 6)
        break
      case "annually":
        nextDate = addYears(nextDate, 1)
        break
      case "custom":
        if (customInterval && customIntervalUnit) {
          switch (customIntervalUnit) {
            case "days":
              nextDate = addDays(nextDate, customInterval)
              break
            case "weeks":
              nextDate = addDays(nextDate, customInterval * 7)
              break
            case "months":
              nextDate = addMonths(nextDate, customInterval)
              break
            case "years":
              nextDate = addYears(nextDate, customInterval)
              break
          }
        }
        break
    }
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
      if (customInterval && customIntervalUnit) {
        switch (customIntervalUnit) {
          case "days":
            return amount * (365 / customInterval)
          case "weeks":
            return amount * (52 / customInterval)
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

export default function SubscriptionsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Record<string, boolean>>({})
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<string>("nextPaymentDate")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [paymentHistories, setPaymentHistories] = useState<Record<string, PaymentHistory[]>>({})
  const [mounted, setMounted] = useState(false)

  // Form state for adding/editing subscription
  const [formData, setFormData] = useState({
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

  // Fetch subscriptions when user is available
  useEffect(() => {
    if (user && mounted) {
      fetchSubscriptions()
    }
  }, [user, mounted])

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
      let valueA, valueB

      switch (sortBy) {
        case "name":
          valueA = a.name.toLowerCase()
          valueB = b.name.toLowerCase()
          break
        case "amount":
          valueA = a.amount
          valueB = b.amount
          break
        case "nextPaymentDate":
          valueA = safeParseDate(a.nextPaymentDate).getTime()
          valueB = safeParseDate(b.nextPaymentDate).getTime()
          break
        case "billingCycle":
          valueA = a.billingCycle
          valueB = b.billingCycle
          break
        case "category":
          valueA = a.category
          valueB = b.category
          break
        default:
          valueA = new Date(a.nextPaymentDate).getTime()
          valueB = new Date(b.nextPaymentDate).getTime()
      }

      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })

    setFilteredSubscriptions(result)
  }, [subscriptions, searchQuery, categoryFilter, sortBy, sortDirection])

  // Fetch subscriptions from Firestore
  const fetchSubscriptions = async () => {
    if (!user) return

    setLoading(true)
    try {
      const subscriptionsRef = collection(db, "subscriptions")
      const q = query(subscriptionsRef, where("userId", "==", user.uid), orderBy("nextPaymentDate", "asc"))

      const querySnapshot = await getDocs(q)
      const subscriptionsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Subscription[]

      setSubscriptions(subscriptionsData)

      // Generate payment histories for each subscription
      const histories: Record<string, PaymentHistory[]> = {}
      subscriptionsData.forEach((subscription) => {
        histories[subscription.id] = generatePaymentHistory(subscription)
      })
      setPaymentHistories(histories)
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
  }

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
    if (formData.billingCycle === "custom" && (!formData.customInterval || !formData.customIntervalUnit)) {
      toast({
        title: "Missing custom interval",
        description: "Please specify a custom billing interval",
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
        formData.customInterval ? Number.parseInt(formData.customInterval) : undefined,
        formData.customIntervalUnit,
      )

      // Prepare subscription data
      const subscriptionData: Omit<Subscription, "id" | "createdAt"> = {
        name: formData.name,
        logo: SERVICE_LOGOS[formData.name] || `/placeholder.svg?height=40&width=40&text=${formData.name.charAt(0)}`,
        amount: Number.parseFloat(formData.amount),
        billingCycle: formData.billingCycle as "monthly" | "quarterly" | "semi-annually" | "annually" | "custom",
        startDate: formData.startDate.toISOString(),
        nextPaymentDate: nextPaymentDate.toISOString(),
        paymentMethod: formData.paymentMethod,
        website: formData.website || null,
        notes: formData.notes || null,
        autoRenew: formData.autoRenew,
        category: formData.category,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      }

      // Only include custom interval fields if billing cycle is custom
      if (formData.billingCycle === "custom") {
        subscriptionData.customInterval = Number.parseInt(formData.customInterval)
        subscriptionData.customIntervalUnit = formData.customIntervalUnit as "days" | "weeks" | "months" | "years"
      }

      // Add subscription to Firestore
      const docRef = await addDoc(collection(db, "subscriptions"), {
        ...subscriptionData,
        createdAt: new Date().toISOString(),
      })

      // Add to local state
      const newSubscription = {
        id: docRef.id,
        ...subscriptionData,
        createdAt: new Date().toISOString(),
      } as Subscription

      setSubscriptions((prev) => [...prev, newSubscription])

      // Generate payment history
      const history = generatePaymentHistory(newSubscription)
      setPaymentHistories((prev) => ({
        ...prev,
        [newSubscription.id]: history,
      }))

      toast({
        title: "Subscription added",
        description: "Your subscription has been added successfully",
      })

      // Reset form and close dialog
      resetForm()
      setOpenDialog(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error adding your subscription"
      toast({
        title: "Error adding subscription",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle subscription deletion
  const handleDeleteSubscription = async () => {
    if (!subscriptionToDelete) return

    try {
      await deleteDoc(doc(db, "subscriptions", subscriptionToDelete))

      // Update local state
      setSubscriptions((prev) => prev.filter((subscription) => subscription.id !== subscriptionToDelete))

      // Remove from expanded subscriptions
      const { [subscriptionToDelete]: _, ...rest } = expandedSubscriptions
      setExpandedSubscriptions(rest)

      // Remove payment history
      const { [subscriptionToDelete]: __, ...restHistories } = paymentHistories
      setPaymentHistories(restHistories)

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

  // Calculate total monthly and annual costs
  const calculateTotalCosts = () => {
    let monthlyTotal = 0
    let annualTotal = 0

    filteredSubscriptions.forEach((subscription) => {
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
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <PageHeader
            title="Subscriptions"
            description="Manage your recurring subscriptions and services"
            action={
              <Button onClick={() => setOpenDialog(true)} className="bg-cream text-dark hover:bg-cream/90 font-medium">
                <Plus className="mr-2 h-4 w-4" />
                Add Subscription
              </Button>
            }
          />

          <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium">Overview</h3>
                <div className="flex">
                  <div className="flex flex-col items-left text-left w-28 pr-6 border-r border-cream/10">
                    <p className="text-sm text-cream/60">Monthly Cost</p>
                    <p className="text-xl font-medium mt-1">${monthlyTotal.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-center text-left w-28 border-r border-cream/10">
                    <p className="text-sm text-cream/60">Annual Cost</p>
                    <p className="text-xl font-medium mt-1">${annualTotal.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-left text-left w-28 pl-6">
                    <p className="text-sm text-cream/60">Subscriptions</p>
                    <p className="text-xl font-medium mt-1">{filteredSubscriptions.length}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/40" />
                  <Input
                    placeholder="Search subscriptions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-[180px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
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
                    <SelectTrigger className="w-full md:w-[180px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
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

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredSubscriptions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-cream/60 mb-4">No subscriptions found</p>
                <Button
                  onClick={() => setOpenDialog(true)}
                  variant="outline"
                  className="bg-transparent border-cream/10 text-cream hover:bg-cream/10"
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
                      <div className="flex items-center justify-between md:grid md:grid-cols-12 md:gap-4">
                        <div className="flex items-center gap-4 col-span-3">
                          <div className="h-10 w-10 rounded-md bg-cream/10 flex items-center justify-center overflow-hidden">
                            {subscription.logo ? (
                              <img
                                src={subscription.logo || "/placeholder.svg"}
                                alt={subscription.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-medium">{subscription.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium">{subscription.name}</h3>
                            <p className="text-sm text-cream/60">{subscription.category}</p>
                          </div>
                        </div>

                        <div className="hidden md:flex justify-center items-center col-span-2 border-l border-cream/10 h-full">
                          <span>
                            {formatBillingCycle(
                              subscription.billingCycle,
                              subscription.customInterval,
                              subscription.customIntervalUnit,
                            )}
                          </span>
                        </div>
                        
                        <div className="hidden md:flex justify-center items-center col-span-3 border-l border-cream/10 h-full">
                          <span>{format(safeParseDate(subscription.nextPaymentDate), "MMM d, yyyy")}</span>
                        </div>
                        
                        <div className="hidden md:flex justify-center items-center col-span-2 border-l border-cream/10 h-full">
                          <span>{subscription.paymentMethod}</span>
                        </div>
                        
                        <div className="hidden md:flex justify-center items-center col-span-2 border-l border-cream/10 h-full">
                          <div className="flex items-center">
                            <span className="font-medium">${subscription.amount.toFixed(2)}</span>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 ml-2 text-cream/60 hover:text-cream hover:bg-cream/10 flex-shrink-0"
                              >
                                {expandedSubscriptions[subscription.id] ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>

                        <div className="flex md:hidden flex-col items-end">
                          <div className="flex items-center">
                            <p className="font-medium">${subscription.amount.toFixed(2)}</p>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 ml-2 text-cream/60 hover:text-cream hover:bg-cream/10 flex-shrink-0"
                              >
                                {expandedSubscriptions[subscription.id] ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                          <p className="text-xs text-cream/60">
                            Next: {format(safeParseDate(subscription.nextPaymentDate), "MMM d")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="p-4 bg-cream/5 border-t border-cream/10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium mb-4">Subscription Details</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <p className="text-sm text-cream/60">Start Date</p>
                                <p className="text-sm">{format(safeParseDate(subscription.startDate), "MMMM d, yyyy")}</p>
                              </div>
                              <div className="flex justify-between">
                                <p className="text-sm text-cream/60">Next Payment</p>
                                <p className="text-sm">
                                  {format(safeParseDate(subscription.nextPaymentDate), "MMMM d, yyyy")}
                                </p>
                              </div>
                              <div className="flex justify-between">
                                <p className="text-sm text-cream/60">Billing Cycle</p>
                                <p className="text-sm">
                                  {formatBillingCycle(
                                    subscription.billingCycle,
                                    subscription.customInterval,
                                    subscription.customIntervalUnit,
                                  )}
                                </p>
                              </div>
                              <div className="flex justify-between">
                                <p className="text-sm text-cream/60">Payment Method</p>
                                <p className="text-sm">{subscription.paymentMethod}</p>
                              </div>
                              <div className="flex justify-between">
                                <p className="text-sm text-cream/60">Auto-Renew</p>
                                <p className="text-sm">{subscription.autoRenew ? "Yes" : "No"}</p>
                              </div>
                              <div className="flex justify-between">
                                <p className="text-sm text-cream/60">Amount per Billing Cycle</p>
                                <p className="text-sm font-medium">${subscription.amount.toFixed(2)}</p>
                              </div>
                              <div className="flex justify-between">
                                <p className="text-sm text-cream/60">Annual Cost</p>
                                <p className="text-sm font-medium">
                                  $
                                  {calculateAnnualCost(
                                    subscription.amount,
                                    subscription.billingCycle,
                                    subscription.customInterval,
                                    subscription.customIntervalUnit,
                                  ).toFixed(2)}
                                </p>
                              </div>
                              {subscription.website && (
                                <div className="flex justify-between">
                                  <p className="text-sm text-cream/60">Website</p>
                                  <a
                                    href={subscription.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-cream flex items-center hover:underline"
                                  >
                                    Visit Site
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              {subscription.notes && (
                                <div>
                                  <p className="text-sm text-cream/60 mb-1">Notes</p>
                                  <p className="text-sm">{subscription.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-4">Payment History</h4>
                            {paymentHistories[subscription.id] && paymentHistories[subscription.id].length > 0 ? (
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-cream/10 hover:bg-transparent">
                                      <TableHead className="text-cream/60">Date</TableHead>
                                      <TableHead className="text-cream/60">Amount</TableHead>
                                      <TableHead className="text-cream/60">Status</TableHead>
                                      <TableHead className="text-cream/60">Method</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {paymentHistories[subscription.id]
                                      .sort((a, b) => safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime())
                                      .slice(0, 5)
                                      .map((payment) => (
                                        <TableRow key={payment.id} className="border-cream/10">
                                          <TableCell>{format(safeParseDate(payment.date), "MMM d, yyyy")}</TableCell>
                                          <TableCell>${payment.amount.toFixed(2)}</TableCell>
                                          <TableCell>
                                            <span
                                              className={`px-2 py-1 rounded-full text-xs ${
                                                payment.status === "paid"
                                                  ? "bg-green-500/20 text-green-400"
                                                  : payment.status === "pending"
                                                    ? "bg-yellow-500/20 text-yellow-400"
                                                    : "bg-red-500/20 text-red-400"
                                              }`}
                                            >
                                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                            </span>
                                          </TableCell>
                                          <TableCell>{payment.paymentMethod}</TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-cream/60">No payment history available</p>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end mt-6 gap-2">
                          <Button
                            variant="outline"
                            className="bg-transparent border-cream/10 text-cream hover:bg-cream/10"
                            onClick={() => {
                              // Edit functionality would go here
                              toast({
                                title: "Edit feature",
                                description: "Edit functionality is not implemented in this demo",
                              })
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="bg-transparent border-red-500/20 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-dark border-cream/10 text-cream">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                                <AlertDialogDescription className="text-cream/60">
                                  Are you sure you want to delete the &quot;{subscription.name}&quot; subscription? This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => setSubscriptionToDelete(subscription.id)}
                                  className="bg-red-500 text-white hover:bg-red-600"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
      ;
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="bg-dark border-cream/10 text-cream sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add New Subscription</DialogTitle>
            <DialogDescription className="text-cream/60">
              Add details about your subscription to track payments and renewals.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="space-y-2 flex gap-2 items-end">
                  <div className="flex-1">
                    <label htmlFor="customInterval" className="text-sm font-outfit block">
                      Interval *
                    </label>
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
                  <PopoverContent className="w-auto p-0 bg-dark border-cream/10">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm()
                  setOpenDialog(false)
                }}
                className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-cream text-dark hover:bg-cream/90 font-medium">
                {loading ? "Adding..." : "Add Subscription"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      ;
      <AlertDialog open={!!subscriptionToDelete} onOpenChange={(open) => !open && setSubscriptionToDelete(null)}>
        <AlertDialogContent className="bg-dark border-cream/10 text-cream">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60">
              Are you sure you want to delete this subscription? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubscription} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

