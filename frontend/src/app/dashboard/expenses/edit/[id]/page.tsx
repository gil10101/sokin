"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { format, parseISO, startOfDay } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { useNotifications } from "@/contexts/notifications-context"
import { expensesAPI } from "@/lib/api"
import { useCategories } from "@/hooks/use-categories"
import { validateExpenseAmount, isValidAmountInput } from "@/lib/expense-validation"

interface EditExpensePageProps {
  params?: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string>>;
}

export default function EditExpensePage(props: EditExpensePageProps) {
  const { user } = useAuth()
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { addNotification } = useNotifications()
  const expenseId = params?.id as string

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()))
  const [category, setCategory] = useState("")
  const { categories } = useCategories()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openCategoryPopover, setOpenCategoryPopover] = useState(false)
  const [openDatePopover, setOpenDatePopover] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Snapshot of the loaded expense, used for the unsaved-changes check on Cancel
  const initialFormRef = useRef<{
    name: string
    amount: string
    description: string
    category: string
    date: string
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchExpense = useCallback(async () => {
    if (!userRef.current || !expenseId) return

    try {
      const expenseData = await expensesAPI.getExpenseById(expenseId)

      const initialName = expenseData.name || ""
      const initialAmount = expenseData.amount?.toString() || ""
      const initialDescription = expenseData.description || ""
      const initialCategory = expenseData.category || ""

      // Parse date with robust handling
      let initialDate = startOfDay(new Date())
      if (expenseData.date) {
        const parsedDate = parseISO(String(expenseData.date))
        if (!isNaN(parsedDate.getTime())) {
          initialDate = parsedDate
        }
      }

      // Set form data
      setName(initialName)
      setAmount(initialAmount)
      setDescription(initialDescription)
      setCategory(initialCategory)
      setDate(initialDate)

      initialFormRef.current = {
        name: initialName,
        amount: initialAmount,
        description: initialDescription,
        category: initialCategory,
        date: initialDate.toISOString(),
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error loading the expense"
      toast({
        title: "Error loading expense",
        description: errorMessage,
        variant: "destructive",
      })
      router.push("/dashboard/expenses")
    } finally {
      setLoading(false)
    }
  }, [expenseId])

  useEffect(() => {
    if (user && mounted) {
      fetchExpense()
    }
  }, [user, mounted])

  const hasUnsavedChanges = () => {
    const initial = initialFormRef.current
    if (!initial) return false

    return (
      name !== initial.name ||
      amount !== initial.amount ||
      description !== initial.description ||
      category !== initial.category ||
      date.toISOString() !== initial.date
    )
  }

  const handleCancel = () => {
    if (hasUnsavedChanges() && !window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
      return
    }
    router.push("/dashboard/expenses")
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

    // Validate amount
    const amountValidation = validateExpenseAmount(amount)
    if (!amountValidation.ok) {
      toast({
        title: "Invalid amount",
        description: amountValidation.error,
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      await expensesAPI.updateExpense(expenseId, {
        name,
        amount: amountValidation.value,
        description: description || "",
        category,
        date: date.toISOString(),
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error updating your expense"
      toast({
        title: "Error updating expense",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value
                    // Allow empty string or valid positive numbers with up to 2 decimal places
                    if (isValidAmountInput(value)) {
                      setAmount(value)
                    }
                  }}
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
                              onSelect={(currentValue: string) => {
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
                        setDate(date || startOfDay(new Date()))
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
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Add any additional details..."
                className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 min-h-[100px]"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
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
  )
}

