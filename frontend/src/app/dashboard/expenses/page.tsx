"use client"

import React from "react"

import { useState, useEffect, useCallback } from "react"
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore"
import { db } from "../../../lib/firebase"
import { useAuth } from "../../../contexts/auth-context"
import { format, isValid, parseISO } from "date-fns"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { Input } from "../../../components/ui/input"
import { Button } from "../../../components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog"
import { Search, Trash2, Edit, ChevronDown, ChevronRight, ChevronLeft, Receipt, ChevronsLeft, ChevronsRight } from "lucide-react"
import { AddButton } from "../../../components/ui/add-button"
import Image from "next/image"
import { useToast } from "../../../hooks/use-toast"
import { useRouter } from "next/navigation"
import { MotionContainer } from "../../../components/ui/motion-container"
import { LoadingSpinner } from "../../../components/ui/loading-spinner"
// Import the useNotifications hook
import { useNotifications } from "../../../contexts/notifications-context"

interface Expense {
  id: string
  name: string
  description?: string
  amount: number
  category: string
  date: string
  createdAt: string
  userId: string
  receiptImageUrl?: string
  receiptData?: {
    merchant?: string
    confidence?: number
    items?: string[]
    rawText?: string
  }
}

// Helper function to safely format dates
type DateValue = Date | number | string | { toDate(): Date } | null | undefined
const safeFormatDate = (dateValue: DateValue, formatStr: string): string => {
  try {
    let date: Date | null = null
    
    // Handle different date formats
    if (!dateValue) {
      return "Invalid date"
    }
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      date = dateValue
    }
    // If it's a Firebase Timestamp object
    else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
      date = dateValue.toDate()
    }
    // If it's a numeric timestamp (milliseconds)
    else if (typeof dateValue === 'number') {
      date = new Date(dateValue)
    }
    // If it's a string
    else if (typeof dateValue === 'string') {
      // Try parsing as ISO string first
      date = parseISO(dateValue)
      
      // If parseISO fails, try native Date constructor
      if (!isValid(date)) {
        date = new Date(dateValue)
      }
    }
    
    // Final validation
    if (!date || !isValid(date)) {
      return "Invalid date"
    }
    
    return format(date, formatStr)
  } catch (error) {

    return "Invalid date"
  }
}

export default function ExpensesPage() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  // Add the useNotifications hook to the component
  const { addNotification } = useNotifications()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date-desc")
  const [categories, setCategories] = useState<string[]>([])
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  useEffect(() => {
    setMounted(true)
  }, [])



  const fetchExpenses = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      const expensesRef = collection(db, "expenses")
      const q = query(expensesRef, where("userId", "==", user.uid), orderBy("date", "desc"))

      const querySnapshot = await getDocs(q)
      const expensesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[]

      setExpenses(expensesData)
      setFilteredExpenses(expensesData)

      // Extract unique categories
      const uniqueCategories = Array.from(new Set(expensesData.map((expense) => expense.category)))
      setCategories(uniqueCategories as string[])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error loading your expenses"
      toast({
        title: "Error loading expenses",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  useEffect(() => {
    if (user && mounted) {
      fetchExpenses()
    }
  }, [user, mounted, fetchExpenses])

  useEffect(() => {
    // Apply filters and sorting
    let result = [...expenses]

    // Apply search filter
    if (searchQuery) {
      result = result.filter(
        (expense) =>
          expense.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          expense.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    // Apply category filter
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((expense) => expense.category === categoryFilter)
    }

    // Apply sorting
    switch (sortBy) {
      case "amount-asc":
        result.sort((a, b) => a.amount - b.amount)
        break
      case "amount-desc":
        result.sort((a, b) => b.amount - a.amount)
        break
      case "date-asc":
        result.sort((a, b) => {
          try {
            // Safely parse dates using the same logic as safeFormatDate
            const parseDate = (dateValue: DateValue): number => {
              if (!dateValue) return 0
              
              if (dateValue instanceof Date) {
                return dateValue.getTime()
              }
              if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
                return dateValue.toDate().getTime()
              }
              if (typeof dateValue === 'number') {
                return dateValue
              }
              if (typeof dateValue === 'string') {
                const parsedDate = new Date(dateValue)
                return isValid(parsedDate) ? parsedDate.getTime() : 0
              }
              return 0
            }
            
            const dateA = parseDate(a.date)
            const dateB = parseDate(b.date)
            return dateA - dateB
          } catch (error) {
            return 0
          }
        })
        break
      case "date-desc":
      default:
        result.sort((a, b) => {
          try {
            // Safely parse dates using the same logic as safeFormatDate
            const parseDate = (dateValue: DateValue): number => {
              if (!dateValue) return 0
              
              if (dateValue instanceof Date) {
                return dateValue.getTime()
              }
              if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
                return dateValue.toDate().getTime()
              }
              if (typeof dateValue === 'number') {
                return dateValue
              }
              if (typeof dateValue === 'string') {
                const parsedDate = new Date(dateValue)
                return isValid(parsedDate) ? parsedDate.getTime() : 0
              }
              return 0
            }
            
            const dateA = parseDate(a.date)
            const dateB = parseDate(b.date)
            return dateB - dateA
          } catch (error) {
            return 0
          }
        })
        break
    }

    setFilteredExpenses(result)
    // Reset to first page when filters change
    setCurrentPage(1)
  }, [expenses, searchQuery, categoryFilter, sortBy])

  // Pagination calculations
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return

    try {
      // Find the expense to get its name
      const expenseToDeleteData = expenses.find((expense) => expense.id === expenseToDelete)

      await deleteDoc(doc(db, "expenses", expenseToDelete))

      // Update local state
      setExpenses(expenses.filter((expense) => expense.id !== expenseToDelete))

      toast({
        title: "Expense deleted",
        description: "The expense has been deleted successfully",
      })

      // Add notification
      await addNotification({
        title: "Expense Deleted",
        message: `Your expense "${expenseToDeleteData?.name || "Unknown"}" has been deleted.`,
        type: "info",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error deleting the expense"
      toast({
        title: "Error deleting expense",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setExpenseToDelete(null)
    }
  }

  const toggleExpenseDetails = (id: string) => {
    setExpandedExpenses((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

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

      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <header className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="ml-12 md:ml-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-medium font-outfit">Expenses</h1>
              <p className="text-cream/60 text-sm mt-1 font-outfit">Manage and track all your expenses</p>
            </div>
            <AddButton
              label="Expense"
              onClick={() => router.push("/dashboard/add-expense")}
            />
          </header>

          <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/40" />
                <Input
                  placeholder="Search expenses..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark border-cream/10">
                    <SelectItem value="all" className="text-cream hover:bg-cream/10">
                      All Categories
                    </SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category} className="text-cream hover:bg-cream/10">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-dark border-cream/10">
                    <SelectItem value="date-desc" className="text-cream hover:bg-cream/10">
                      Date (Newest)
                    </SelectItem>
                    <SelectItem value="date-asc" className="text-cream hover:bg-cream/10">
                      Date (Oldest)
                    </SelectItem>
                    <SelectItem value="amount-desc" className="text-cream hover:bg-cream/10">
                      Amount (Highest)
                    </SelectItem>
                    <SelectItem value="amount-asc" className="text-cream hover:bg-cream/10">
                      Amount (Lowest)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-cream/10 rounded-md" />
                ))}
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-cream/60">No expenses found</p>
                {searchQuery || categoryFilter !== "all" ? (
                  <p className="text-cream/40 text-sm mt-2">Try adjusting your filters</p>
                ) : (
                  <Button
                    onClick={() => router.push("/dashboard/add-expense")}
                    variant="link"
                    className="text-cream mt-4"
                  >
                    Add your first expense
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card Layout */}
                <div className="md:hidden space-y-3">
                  {paginatedExpenses.map((expense) => (
                    <div key={expense.id} className="bg-cream/5 rounded-lg border border-cream/10 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-cream">{expense.name}</h3>
                            {expense.receiptImageUrl && (
                              <Receipt className="h-4 w-4 text-cream/60" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 rounded-full bg-cream/10 text-xs">{expense.category}</span>
                            <span className="text-xs text-cream/60">
                              {expense.date ? safeFormatDate(expense.date, "MMM d, yyyy") : "N/A"}
                            </span>
                          </div>
                          {expense.description && (
                            <p className="text-sm text-cream/70 mt-2">{expense.description}</p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-semibold text-cream">${expense.amount.toFixed(2)}</div>
                          <div className="flex gap-1 mt-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/dashboard/expenses/edit/${expense.id}`)}
                              className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setExpenseToDelete(expense.id)}
                                  className="h-8 w-8 text-cream/60 hover:text-red-400 hover:bg-cream/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-dark border-cream/10 text-cream">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                  <AlertDialogDescription className="text-cream/60">
                                    Are you sure you want to delete this expense? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream">
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleDeleteExpense}
                                    className="bg-red-500 text-white hover:bg-red-600"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-cream/10 hover:bg-transparent">
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="text-cream/60">Name</TableHead>
                        <TableHead className="text-cream/60">Category</TableHead>
                        <TableHead className="text-cream/60">Date</TableHead>
                        <TableHead className="text-cream/60 text-right">Amount</TableHead>
                        <TableHead className="text-cream/60 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {paginatedExpenses.map((expense) => (
                      <React.Fragment key={expense.id}>
                        <TableRow
                          className={`border-cream/10 hover:bg-cream/5 cursor-pointer ${expandedExpenses[expense.id] ? "bg-cream/5" : ""}`}
                          onClick={() => toggleExpenseDetails(expense.id)}
                        >
                          <TableCell className="p-2 pl-4">
                            {expandedExpenses[expense.id] ? (
                              <ChevronDown className="h-4 w-4 text-cream/60" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-cream/60" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {expense.name}
                              {expense.receiptImageUrl && (
                                <Receipt className="h-4 w-4 text-cream/60" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded-full bg-cream/10 text-xs">{expense.category}</span>
                          </TableCell>
                          <TableCell>{expense.date ? safeFormatDate(expense.date, "MMM d, yyyy") : "N/A"}</TableCell>
                          <TableCell className="text-right">${expense.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e: React.MouseEvent<HTMLElement>) => {
                                  e.stopPropagation()
                                  router.push(`/dashboard/expenses/edit/${expense.id}`)
                                }}
                                className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setExpenseToDelete(expense.id)}
                                    className="h-8 w-8 text-cream/60 hover:text-red-400 hover:bg-cream/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-dark border-cream/10 text-cream">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                    <AlertDialogDescription className="text-cream/60">
                                      Are you sure you want to delete this expense? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream">
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={handleDeleteExpense}
                                      className="bg-red-500 text-white hover:bg-red-600"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expandable details row */}
                        {expandedExpenses[expense.id] && (
                          <TableRow className="border-cream/10 bg-cream/5">
                            <TableCell colSpan={6} className="p-4">
                              <div className="pl-6 border-l border-cream/20">
                                <h4 className="text-sm font-medium mb-2">Description</h4>
                                <p className="text-sm text-cream/70 mb-4">
                                  {expense.description || "No description provided"}
                                </p>

                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                  <div>
                                    <h4 className="font-medium mb-1">Created</h4>
                                    <p className="text-cream/70">
                                      {expense.createdAt
                                        ? safeFormatDate(expense.createdAt, "MMM d, yyyy 'at' h:mm a")
                                        : "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium mb-1">Transaction Date</h4>
                                    <p className="text-cream/70">
                                      {expense.date ? safeFormatDate(expense.date, "MMMM d, yyyy") : "N/A"}
                                    </p>
                                  </div>
                                </div>

                                {/* Receipt Information */}
                                {expense.receiptImageUrl && (
                                  <div className="border-t border-cream/10 pt-4">
                                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                      <Receipt className="h-4 w-4" />
                                      Receipt Information
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => setReceiptImageUrl(expense.receiptImageUrl!)}
                                              className="bg-cream/5 border-cream/20 text-cream hover:bg-cream/10"
                                            >
                                              <Receipt className="h-4 w-4 mr-2" />
                                              View Receipt Image
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="max-w-3xl bg-dark border-cream/10">
                                            <DialogHeader>
                                              <DialogTitle className="text-cream">Receipt Image</DialogTitle>
                                            </DialogHeader>
                                            <div className="mt-4">
                                              <Image
                                                src={expense.receiptImageUrl!}
                                                alt="Receipt"
                                                width={800}
                                                height={600}
                                                className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-cream/10"
                                              />
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                      </div>
                                      
                                      {expense.receiptData && (
                                        <div className="space-y-2 text-xs">
                                          {expense.receiptData.merchant && (
                                            <div>
                                              <span className="text-cream/60">Merchant: </span>
                                              <span className="text-cream">{expense.receiptData.merchant}</span>
                                            </div>
                                          )}
                                          {expense.receiptData.confidence && (
                                            <div>
                                              <span className="text-cream/60">OCR Confidence: </span>
                                              <span className="text-cream">{Math.round(expense.receiptData.confidence * 100)}%</span>
                                            </div>
                                          )}
                                          {expense.receiptData.items && expense.receiptData.items.length > 0 && (
                                            <div>
                                              <span className="text-cream/60">Items: </span>
                                              <span className="text-cream">{expense.receiptData.items.slice(0, 2).join(', ')}</span>
                                              {expense.receiptData.items.length > 2 && (
                                                <span className="text-cream/60"> +{expense.receiptData.items.length - 2} more</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls - Always show when there are expenses */}
                {filteredExpenses.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-cream/10">
                    <div className="flex items-center gap-2 text-sm text-cream/60">
                      <span>Showing {startIndex + 1}-{Math.min(endIndex, filteredExpenses.length)} of {filteredExpenses.length}</span>
                      <span className="hidden sm:inline">|</span>
                      <div className="hidden sm:flex items-center gap-2">
                        <span>Per page:</span>
                        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                          <SelectTrigger className="w-20 h-8 bg-cream/5 border-cream/10 text-cream text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-dark border-cream/10">
                            <SelectItem value="10" className="text-cream hover:bg-cream/10">10</SelectItem>
                            <SelectItem value="20" className="text-cream hover:bg-cream/10">20</SelectItem>
                            <SelectItem value="50" className="text-cream hover:bg-cream/10">50</SelectItem>
                            <SelectItem value="100" className="text-cream hover:bg-cream/10">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Only show page navigation when there's more than 1 page */}
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => goToPage(1)}
                          disabled={currentPage === 1}
                          className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10 disabled:opacity-30"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10 disabled:opacity-30"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {/* Page numbers */}
                        <div className="flex items-center gap-1 mx-2">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant="ghost"
                                size="icon"
                                onClick={() => goToPage(pageNum)}
                                className={`h-8 w-8 text-sm ${
                                  currentPage === pageNum
                                    ? "bg-cream/20 text-cream"
                                    : "text-cream/60 hover:text-cream hover:bg-cream/10"
                                }`}
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10 disabled:opacity-30"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => goToPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10 disabled:opacity-30"
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </MotionContainer>
        </div>
      </main>

      {/* Delete Expense Confirmation */}
      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent className="bg-dark border-cream/10 text-cream">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60">
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

