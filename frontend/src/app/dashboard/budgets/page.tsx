"use client"

import type React from "react"

import { useState, useEffect } from "react"

import { collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "../../../lib/firebase"
import { useAuth } from "../../../contexts/auth-context"
import { format } from "date-fns"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { PageHeader } from "../../../components/dashboard/page-header"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Calendar } from "../../../components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover"
import { CalendarIcon, Plus, Pencil, Trash2, AlertCircle } from "lucide-react"
import { useToast } from "../../../hooks/use-toast"
import { MotionContainer } from "../../../components/ui/motion-container"
import { BudgetProgressCard } from "../../../components/dashboard/budget-progress-card"
import { Textarea } from "../../../components/ui/textarea"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { motion } from "framer-motion"

// Default categories
const DEFAULT_CATEGORIES = [
  "Dining",
  "Shopping",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Travel",
  "Housing",
  "Food",
  "Other",
]

interface Budget {
  id: string
  amount: number
  category: string
  period: string
  startDate: string
  endDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  userId: string
}

interface Expense {
  id: string
  userId: string
  name: string
  amount: number
  date: string
  category: string
  description?: string
  tags?: string[]
  createdAt: string
  updatedAt?: string
}

interface BudgetFormData {
  amount: string
  category: string
  period: string
  startDate: Date
  endDate: Date | null
  notes: string
}



// Helper function to safely parse dates to Date objects
const safeParseDate = (dateValue: unknown): Date | null => {
  try {
    if (!dateValue) return null

    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue
    }
    // If it's a Firebase Timestamp object
    else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
      const timestampObj = dateValue as { toDate: () => Date }
      return timestampObj.toDate()
    }
    // If it's a numeric timestamp (milliseconds)
    else if (typeof dateValue === 'number') {
      return new Date(dateValue)
    }
    // If it's a string
    else if (typeof dateValue === 'string') {
      const parsedDate = new Date(dateValue)
      return isNaN(parsedDate.getTime()) ? null : parsedDate
    }

    return null
  } catch (error) {
    return null
  }
}

export default function BudgetsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()

  const { toast } = useToast()

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  // Form state
  const [formData, setFormData] = useState<BudgetFormData>({
    amount: "",
    category: "",
    period: "monthly",
    startDate: new Date(),
    endDate: null,
    notes: "",
  })

  useEffect(() => {
    fetchBudgets()
    fetchExpenses()
    fetchCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchBudgets = async () => {
    if (!user) return

    setLoading(true)
    try {
      const budgetsRef = collection(db, "budgets")
      const q = query(budgetsRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"))

      const querySnapshot = await getDocs(q)
      const budgetsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Budget[]

      setBudgets(budgetsData)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error loading your budgets"
      toast({
        title: "Error loading budgets",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchExpenses = async () => {
    if (!user) return

    try {
      const expensesRef = collection(db, "expenses")
      const q = query(expensesRef, where("userId", "==", user.uid), orderBy("date", "desc"))

      const querySnapshot = await getDocs(q)
      const expensesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Expense[]

      setExpenses(expensesData)
    } catch (error: unknown) {
      // Don't show toast for expenses error since it's secondary data
    }
  }

  const fetchCategories = async () => {
    if (!user) return

    try {
      // Try to fetch user-specific categories first
      const userCategoriesDoc = await getDocs(collection(db, "users", user.uid, "categories"))

      if (!userCategoriesDoc.empty) {
        const userCategories = userCategoriesDoc.docs[0].data().categories
        if (userCategories && userCategories.length > 0) {
          setCategories(userCategories)
          return
        }
      }

      // Fallback to global categories if user doesn't have any
      const categoriesSnapshot = await getDocs(collection(db, "categories"))
      if (!categoriesSnapshot.empty) {
        const categoriesList = categoriesSnapshot.docs.map((doc) => doc.data().name)
        if (categoriesList.length > 0) {
          setCategories([...DEFAULT_CATEGORIES, ...categoriesList])
          return
        }
      }
    } catch (error) {
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (name: "startDate" | "endDate", date: Date | undefined) => {
    setFormData((prev) => ({ ...prev, [name]: date || null }))
  }

  const resetForm = () => {
    setFormData({
      amount: "",
      category: "",
      period: "monthly",
      startDate: new Date(),
      endDate: null,
      notes: "",
    })
    setEditingBudget(null)
  }

  const openEditDialog = (budget: Budget) => {
    setEditingBudget(budget)
    setFormData({
      amount: budget.amount.toString(),
      category: budget.category,
      period: budget.period,
      startDate: safeParseDate(budget.startDate) || new Date(),
      endDate: budget.endDate ? safeParseDate(budget.endDate) : null,
      notes: budget.notes || "",
    })
    setOpenDialog(true)
  }

  const calculateBudgetProgress = (budget: Budget): { spent: number; progress: number } => {
    if (!expenses.length) {
      console.log(`No expenses found for budget ${budget.category}`)
      return { spent: 0, progress: 0 }
    }

    // Parse budget dates safely
    const budgetStartDate = safeParseDate(budget.startDate)
    const budgetEndDate = budget.endDate ? safeParseDate(budget.endDate) : null

    if (!budgetStartDate) {
      return { spent: 0, progress: 0 }
    }

    // Calculate the effective end date based on period
    let effectiveEndDate = budgetEndDate
    if (!effectiveEndDate && budgetStartDate) {
      const startDate = new Date(budgetStartDate)
      switch (budget.period) {
        case "monthly":
          effectiveEndDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate())
          break
        case "yearly":
          effectiveEndDate = new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate())
          break
        case "weekly":
          effectiveEndDate = new Date(startDate)
          effectiveEndDate.setDate(startDate.getDate() + 7)
          break
        case "daily":
          effectiveEndDate = new Date(startDate)
          effectiveEndDate.setDate(startDate.getDate() + 1)
          break
        default:
          // For custom periods, use current date if no end date
          effectiveEndDate = new Date()
          break
      }
    }

    // Filter expenses that match this budget's category and date range
    const relevantExpenses = expenses.filter((expense) => {
      const expenseDate = safeParseDate(expense.date)
      
      if (!expenseDate) {
        return false
      }
      
      const matchesCategory = expense.category === budget.category
      const isInDateRange = expenseDate >= budgetStartDate && (!effectiveEndDate || expenseDate <= effectiveEndDate)

      return matchesCategory && isInDateRange
    })

    // Calculate total spent
    const totalSpent = relevantExpenses.reduce((total, expense) => total + expense.amount, 0)
    
    // Calculate progress percentage
    const progress = budget.amount > 0 ? Math.round((totalSpent / budget.amount) * 100) : 0

    return { spent: totalSpent, progress }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to manage budgets",
        variant: "destructive",
      })
      return
    }

    if (!formData.amount || !formData.category || !formData.period || !formData.startDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const budgetData = {
        amount: Number(formData.amount),
        category: formData.category,
        period: formData.period,
        startDate: formData.startDate.toISOString(),
        endDate: formData.endDate ? formData.endDate.toISOString() : null,
        notes: formData.notes || null,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      }

      if (editingBudget) {
        // Update existing budget
        await updateDoc(doc(db, "budgets", editingBudget.id), {
          ...budgetData,
        })

        toast({
          title: "Budget updated",
          description: "Your budget has been updated successfully",
        })
      } else {
        // Add new budget
        await addDoc(collection(db, "budgets"), {
          ...budgetData,
          createdAt: new Date().toISOString(),
        })

        toast({
          title: "Budget added",
          description: "Your budget has been added successfully",
        })
      }

      // Reset form and refresh budgets
      resetForm()
      setOpenDialog(false)
      fetchBudgets()
      fetchExpenses() // Refresh expenses to recalculate progress
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : `There was an error ${editingBudget ? "updating" : "adding"} your budget`
      toast({
        title: editingBudget ? "Error updating budget" : "Error adding budget",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBudget = async () => {
    if (!budgetToDelete) return

    try {
      await deleteDoc(doc(db, "budgets", budgetToDelete))

      // Update local state
      setBudgets(budgets.filter((budget) => budget.id !== budgetToDelete))

      toast({
        title: "Budget deleted",
        description: "The budget has been deleted successfully",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error deleting the budget"
      toast({
        title: "Error deleting budget",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setBudgetToDelete(null)
    }
  }

  const filteredBudgets = activeTab === "all" ? budgets : budgets.filter((budget) => budget.period === activeTab)

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <PageHeader
            title="Budgets"
            description="Manage your spending limits and financial goals"
            action={
              <Button
                onClick={() => {
                  resetForm()
                  setOpenDialog(true)
                }}
                className="bg-cream text-dark hover:bg-cream/90 font-medium"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Budget
              </Button>
            }
          />

          <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8">
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-cream/5 text-cream mb-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-cream/10">
                  All Budgets
                </TabsTrigger>
                <TabsTrigger value="monthly" className="data-[state=active]:bg-cream/10">
                  Monthly
                </TabsTrigger>
                <TabsTrigger value="yearly" className="data-[state=active]:bg-cream/10">
                  Yearly
                </TabsTrigger>
                <TabsTrigger value="custom" className="data-[state=active]:bg-cream/10">
                  Custom
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-[200px] bg-cream/10 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredBudgets.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto h-12 w-12 text-cream/40 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No budgets found</h3>
                    <p className="text-cream/60 mb-6">
                      {activeTab === "all"
                        ? "You haven't created any budgets yet."
                        : `You don't have any ${activeTab} budgets.`}
                    </p>
                    <Button
                      onClick={() => {
                        resetForm()
                        if (activeTab !== "all") {
                          setFormData((prev) => ({ ...prev, period: activeTab }))
                        }
                        setOpenDialog(true)
                      }}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create a Budget
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredBudgets.map((budget) => (
                      <BudgetCard
                        key={budget.id}
                        budget={budget}
                        onEdit={() => openEditDialog(budget)}
                        onDelete={() => setBudgetToDelete(budget.id)}
                        calculateProgress={calculateBudgetProgress}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </MotionContainer>

          <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-6">
            <h2 className="text-xl font-medium mb-6">Budget Progress</h2>
            <BudgetProgressCard />
          </MotionContainer>
        </div>
      </main>

      {/* Add/Edit Budget Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="bg-dark border-cream/10 text-cream sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Edit Budget" : "Add New Budget"}</DialogTitle>
            <DialogDescription className="text-cream/60">
              {editingBudget
                ? "Update your budget details below."
                : "Create a new budget to help manage your spending."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-outfit block">
                Budget Amount *
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
                  {categories.map((category) => (
                    <SelectItem key={category} value={category} className="text-cream hover:bg-cream/10">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-outfit block">Budget Period *</label>
              <Select value={formData.period} onValueChange={(value) => handleSelectChange("period", value)} required>
                <SelectTrigger className="bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent className="bg-dark border-cream/10">
                  <SelectItem value="monthly" className="text-cream hover:bg-cream/10">
                    Monthly
                  </SelectItem>
                  <SelectItem value="yearly" className="text-cream hover:bg-cream/10">
                    Yearly
                  </SelectItem>
                  <SelectItem value="custom" className="text-cream hover:bg-cream/10">
                    Custom
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      onSelect={date => handleDateChange("startDate", date)}
                      initialFocus
                      className="bg-dark text-cream"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {formData.period === "custom" && (
                <div className="space-y-2">
                  <label className="text-sm font-outfit block">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-cream/5 border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.endDate ? format(formData.endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-dark border-cream/10">
                      <Calendar
                        mode="single"
                        selected={formData.endDate || undefined}
                        onSelect={date => handleDateChange("endDate", date)}
                        initialFocus
                        className="bg-dark text-cream"
                        disabled={[
                          {
                            before: formData.startDate
                          }
                        ]}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-outfit block">
                Notes (Optional)
              </label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Add any additional details..."
                className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 min-h-[80px]"
              />
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
                {loading
                  ? editingBudget
                    ? "Updating..."
                    : "Adding..."
                  : editingBudget
                    ? "Update Budget"
                    : "Add Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Budget Confirmation */}
      <AlertDialog open={!!budgetToDelete} onOpenChange={(open) => !open && setBudgetToDelete(null)}>
        <AlertDialogContent className="bg-dark border-cream/10 text-cream">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription className="text-cream/60">
              Are you sure you want to delete this budget? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBudget} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface BudgetCardProps {
  budget: Budget
  onEdit: () => void
  onDelete: () => void
  calculateProgress: (budget: Budget) => { spent: number; progress: number }
}

function BudgetCard({ budget, onEdit, onDelete, calculateProgress }: BudgetCardProps) {
  // Calculate actual progress using real expense data
  const { spent, progress } = calculateProgress(budget)
  const isOverBudget = progress > 100

  // Safely parse dates with robust handling
  const parseDate = (dateValue: unknown): Date | null => {
    if (!dateValue) return null

    try {
      // If it's already a Date object
      if (dateValue instanceof Date) {
        return dateValue
      }
      // If it's a Firebase Timestamp object
      else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
        const timestampObj = dateValue as { toDate: () => Date }
        return timestampObj.toDate()
      }
      // If it's a numeric timestamp (milliseconds)
      else if (typeof dateValue === 'number') {
        return new Date(dateValue)
      }
      // If it's a string
      else if (typeof dateValue === 'string') {
        const parsedDate = new Date(dateValue)
        return isNaN(parsedDate.getTime()) ? null : parsedDate
      }

      return null
    } catch (error) {
      return null
    }
  }

  const startDate = parseDate(budget.startDate)
  const endDate = parseDate(budget.endDate)

  // Validate dates
  const isValidEndDate = endDate && !isNaN(endDate.getTime())

  // Format period display
  let periodDisplay = ""
  switch (budget.period) {
    case "monthly":
      periodDisplay = "Monthly"
      break
    case "yearly":
      periodDisplay = "Yearly"
      break
    case "custom":
      periodDisplay = "Custom"
      break
    default:
      periodDisplay = budget.period
  }

  // Format date safely
  const formatDate = (date: Date | null) => {
    if (!date || isNaN(date.getTime())) return "Invalid date"
    return format(date, "MMM d, yyyy")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-cream/5 rounded-xl border border-cream/10 p-6 hover:border-cream/20 transition-all duration-300"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium font-outfit">{budget.category}</h3>
          <p className="text-cream/60 text-sm">
            {periodDisplay} • {formatDate(startDate)}
            {isValidEndDate ? ` - ${formatDate(endDate)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8 bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 bg-transparent border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-baseline">
          <div className="text-2xl font-medium">${budget.amount.toFixed(2)}</div>
          <div className={isOverBudget ? "text-red-400" : "text-cream/60"}>
            ${spent.toFixed(2)} spent
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-cream/60">Progress</span>
            <span className={isOverBudget ? "text-red-400" : "text-cream/60"}>{progress}%</span>
          </div>
          <div className="h-2 bg-cream/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget ? "bg-red-400" : "bg-cream/40"
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          {isOverBudget && (
            <p className="text-xs text-red-400 mt-1">
              Over budget by ${(spent - budget.amount).toFixed(2)}
            </p>
          )}
        </div>

        {budget.notes && (
          <div className="text-sm text-cream/60 mt-4">
            <p>{budget.notes}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

