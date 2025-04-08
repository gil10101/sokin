"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { format, parseISO } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useNotifications } from "@/contexts/notifications-context"

// Default categories if we can't fetch from Firestore
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

export default function EditExpensePage() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { addNotification } = useNotifications()
  const expenseId = params.id as string

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState<Date>(new Date())
  const [category, setCategory] = useState("")
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openCategoryPopover, setOpenCategoryPopover] = useState(false)
  const [openDatePopover, setOpenDatePopover] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user && mounted) {
      fetchExpense()
      fetchCategories()
    }
  }, [user, mounted])

  const fetchExpense = async () => {
    if (!user || !expenseId) return

    try {
      const expenseDoc = await getDoc(doc(db, "expenses", expenseId))

      if (!expenseDoc.exists()) {
        toast({
          title: "Expense not found",
          description: "The expense you're trying to edit doesn't exist",
          variant: "destructive",
        })
        router.push("/dashboard/expenses")
        return
      }

      const expenseData = expenseDoc.data()

      // Check if this expense belongs to the current user
      if (expenseData.userId !== user.uid) {
        toast({
          title: "Unauthorized",
          description: "You don't have permission to edit this expense",
          variant: "destructive",
        })
        router.push("/dashboard/expenses")
        return
      }

      // Set form data
      setName(expenseData.name || "")
      setAmount(expenseData.amount?.toString() || "")
      setDescription(expenseData.description || "")
      setCategory(expenseData.category || "")

      // Parse date
      if (expenseData.date) {
        try {
          const parsedDate = parseISO(expenseData.date)
          setDate(parsedDate)
        } catch (error) {
          console.error("Error parsing date:", error)
          setDate(new Date())
        }
      }
    } catch (error: any) {
      toast({
        title: "Error loading expense",
        description: error.message || "There was an error loading the expense",
        variant: "destructive",
      })
      router.push("/dashboard/expenses")
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    if (!user) return

    try {
      // Try to fetch user-specific categories first
      const userCategoriesDoc = await getDoc(doc(db, "users", user.uid, "categories", "default"))

      if (userCategoriesDoc.exists()) {
        const userCategories = userCategoriesDoc.data().categories
        if (userCategories && userCategories.length > 0) {
          setCategories(userCategories)
          return
        }
      }

      // Use default categories if user doesn't have any
      setCategories(DEFAULT_CATEGORIES)
    } catch (error) {
      console.error("Error fetching categories:", error)
      // Use default categories if there's an error
      setCategories(DEFAULT_CATEGORIES)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to update an expense",
        variant: "destructive",
      })
      return
    }

    if (!name || !amount || !category) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      // Update expense in Firestore
      await updateDoc(doc(db, "expenses", expenseId), {
        name,
        amount: Number.parseFloat(amount),
        description: description || null,
        category,
        date: date.toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Add notification
      await addNotification({
        title: "Expense Updated",
        message: `Your expense "${name}" has been updated successfully.`,
        type: "success",
        link: "/dashboard/expenses",
      })

      toast({
        title: "Expense updated",
        description: "Your expense has been updated successfully",
      })

      // Redirect to expenses page
      router.push("/dashboard/expenses")
    } catch (error: any) {
      toast({
        title: "Error updating expense",
        description: error.message || "There was an error updating your expense",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!mounted || loading) {
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
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-medium font-outfit">Edit Expense</h1>
            <p className="text-cream/60 text-sm mt-1 font-outfit">Update your expense details</p>
          </header>

          <div className="bg-cream/5 rounded-xl border border-cream/10 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-outfit block">
                  Expense Name *
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What is this expense for?"
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
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 pl-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-outfit block">Category *</label>
                  <Popover open={openCategoryPopover} onOpenChange={setOpenCategoryPopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCategoryPopover}
                        className="w-full justify-between bg-cream/5 border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
                      >
                        {category || "Select category..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-dark border-cream/10">
                      <Command className="bg-dark">
                        <CommandInput placeholder="Search category..." className="text-cream" />
                        <CommandList>
                          <CommandEmpty className="text-cream/60">No category found.</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {categories.map((cat) => (
                              <CommandItem
                                key={cat}
                                value={cat}
                                onSelect={(currentValue) => {
                                  setCategory(currentValue)
                                  setOpenCategoryPopover(false)
                                }}
                                className="text-cream hover:bg-cream/10"
                              >
                                <Check className={`mr-2 h-4 w-4 ${category === cat ? "opacity-100" : "opacity-0"}`} />
                                {cat}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-outfit block">Date</label>
                  <Popover open={openDatePopover} onOpenChange={setOpenDatePopover}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-cream/5 border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-dark border-cream/10">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(date) => {
                          setDate(date || new Date())
                          setOpenDatePopover(false)
                        }}
                        initialFocus
                        className="bg-dark text-cream"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-outfit block">
                  Description (Optional)
                </label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any additional details..."
                  className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 min-h-[100px]"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/expenses")}
                  className="bg-transparent border-cream/10 text-cream hover:bg-cream/10"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-cream text-dark hover:bg-cream/90 font-medium">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

