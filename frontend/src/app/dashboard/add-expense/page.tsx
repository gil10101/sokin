"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { format, startOfDay } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown, Plus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { MotionContainer } from "@/components/ui/motion-container"
import { ReceiptScanner } from "@/components/dashboard/receipt-scanner"
import { useQueryClient } from "@tanstack/react-query"
import { logger } from "@/lib/logger"
import { expensesAPI, api } from "@/lib/api"
import { useCategories } from "@/hooks/use-categories"
import { validateExpenseAmount, isValidAmountInput } from "@/lib/expense-validation"

// Import the ParsedReceiptData type from receipt-scanner
interface ParsedReceiptData {
  merchant?: string
  amount?: number
  date?: string
  items?: string[]
  confidence: number
  suggestedName?: string
  suggestedCategory?: string
  suggestedDescription?: string
  imageUrl?: string
  rawText?: string
}

// Import the useNotifications hook
import { useNotifications } from "@/contexts/notifications-context"

// Types for receipt data - extends ParsedReceiptData for compatibility
interface ReceiptData extends ParsedReceiptData {
  [key: string]: unknown
}

interface AddExpensePageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function AddExpensePage(props: AddExpensePageProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Add the useNotifications hook to the component
  const { addNotification } = useNotifications()

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()))
  const [category, setCategory] = useState("")
  const { categories } = useCategories()
  const [loading, setLoading] = useState(false)
  const [openCategoryPopover, setOpenCategoryPopover] = useState(false)
  const [openDatePopover, setOpenDatePopover] = useState(false)

  /**
   * Category suggestion. Deliberately a suggestion the user applies, never an
   * automatic write: silently setting a category on someone's expense is a
   * change they did not make and might not notice.
   */
  const [suggesting, setSuggesting] = useState(false)
  const [suggestion, setSuggestion] = useState<{ category: string; confidence: number; reasoning: string } | null>(null)
  const [aiAvailable, setAiAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const token = await user?.getIdToken()
        const res = (await api.get("ai/status", { token })) as { data?: { available?: boolean } }
        if (!cancelled) setAiAvailable(Boolean(res.data?.available))
      } catch {
        if (!cancelled) setAiAvailable(false)
      }
    }
    if (user) void check()
    return () => { cancelled = true }
  }, [user])

  const handleSuggestCategory = async () => {
    if (!name.trim() || !amount) return
    setSuggesting(true)
    setSuggestion(null)
    try {
      const token = await user?.getIdToken()
      const res = (await api.post("ai/categorize", {
        name: name.trim(),
        amount: parseFloat(amount),
        description: description.trim() || undefined,
      }, { token })) as { data?: { category: string; confidence: number; reasoning: string } }
      if (res.data) setSuggestion(res.data)
    } catch {
      toast({
        title: "Couldn't suggest a category",
        description: "Pick one manually - your entry is unaffected.",
        variant: "destructive",
      })
    } finally {
      setSuggesting(false)
    }
  }
  const [receiptImageUrl, setReceiptImageUrl] = useState("")
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  const handleReceiptData = (data: ParsedReceiptData) => {
    // Auto-fill form with receipt data
    if (data.suggestedName) setName(data.suggestedName)
    if (data.amount) setAmount(data.amount.toString())
    if (data.suggestedCategory) setCategory(data.suggestedCategory)
    if (data.suggestedDescription) setDescription(data.suggestedDescription)
    if (data.date) {
      // Guard against unparseable dates so format() doesn't crash the render
      const parsedDate = new Date(data.date)
      setDate(isNaN(parsedDate.getTime()) ? startOfDay(new Date()) : parsedDate)
    }
    if (data.imageUrl) setReceiptImageUrl(data.imageUrl || "")
    if (data) setReceiptData(data as ReceiptData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to add an expense",
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

    setLoading(true)

    try {
      // Prepare receipt data for API payload, omitting empty values
      const serializableReceiptData = receiptData ? {
        confidence: receiptData.confidence || 0,
        ...(receiptData.merchant ? { merchant: receiptData.merchant } : {}),
        ...(receiptData.amount ? { amount: receiptData.amount } : {}),
        ...(receiptData.date ? { date: receiptData.date } : {}),
        ...(receiptData.items && receiptData.items.length > 0 ? { items: receiptData.items } : {}),
        ...(receiptData.suggestedName ? { suggestedName: receiptData.suggestedName } : {}),
        ...(receiptData.suggestedCategory ? { suggestedCategory: receiptData.suggestedCategory } : {}),
        ...(receiptData.suggestedDescription ? { suggestedDescription: receiptData.suggestedDescription } : {}),
        ...(receiptData.imageUrl ? { imageUrl: receiptData.imageUrl } : {}),
      } : null

      await expensesAPI.createExpense({
        name: name.trim(),
        amount: amountValidation.value,
        description: description?.trim() || "",
        category: category.trim(),
        date: date.toISOString(),
        ...(receiptImageUrl?.trim() ? { receiptImageUrl: receiptImageUrl.trim() } : {}),
        ...(serializableReceiptData ? { receiptData: serializableReceiptData } : {}),
      })

      toast({
        title: "Expense added",
        description: "Your expense has been added successfully",
      })

      // Invalidate and refetch expenses data to update all components that use expense data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      ])

      // Add notification
      await addNotification({
        title: "Expense Added",
        message: `Your expense "${name}" has been added successfully.`,
        type: "success",
        link: "/dashboard/expenses",
      })

      // Reset form
      setName("")
      setAmount("")
      setDescription("")
      setCategory("")
      setDate(startOfDay(new Date()))
      setReceiptImageUrl("")
      setReceiptData(null)

      // Redirect to expenses page
      router.push("/dashboard/expenses")
    } catch (error: unknown) {
      logger.error("Error adding expense", error instanceof Error ? error : { error })
      
      let errorMessage = "There was an error adding your expense"
      
      if (error instanceof Error) {
        errorMessage = error.message
        
      }
      
      toast({
        title: "Error adding expense",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-medium font-outfit">Add Expense</h1>
          <p className="text-cream/60 text-sm mt-1 font-outfit">Record a new expense to track your spending</p>
        </header>

        <MotionContainer className="bg-cream/5 rounded-xl border border-cream/10 p-6">
          {/* Receipt Scanner Section */}
          <div className="mb-6 p-4 bg-cream/5 rounded-lg border border-cream/10">
            <h3 className="text-sm font-medium text-cream mb-3">Scan Receipt (Optional)</h3>
            <p className="text-xs text-cream/60 mb-4">
              Upload a receipt image to automatically extract expense details
            </p>
            <ReceiptScanner onDataExtracted={handleReceiptData} />
          </div>

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
                  min="0.00"
                  required
                  className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 pl-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-outfit block">Category *</label>
                  {aiAvailable && (
                    <button
                      type="button"
                      onClick={handleSuggestCategory}
                      disabled={suggesting || !name.trim() || !amount}
                      className="text-xs text-cream/60 hover:text-cream disabled:opacity-40 disabled:hover:text-cream/60 flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className={`h-3 w-3 ${suggesting ? "animate-pulse" : ""}`} />
                      {suggesting ? "Thinking..." : "Suggest"}
                    </button>
                  )}
                </div>

                {suggestion && (
                  <div className="flex items-start gap-2 rounded-lg border border-cream/15 bg-cream/5 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-cream">
                        {suggestion.category}
                        <span className="text-cream/40 text-xs ml-2 font-roboto-mono">
                          {Math.round(suggestion.confidence * 100)}% confident
                        </span>
                      </p>
                      <p className="text-xs text-cream/60 mt-0.5">{suggestion.reasoning}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => { setCategory(suggestion.category); setSuggestion(null) }}
                        className="text-xs px-2 py-1 rounded bg-cream text-dark hover:bg-cream/90"
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuggestion(null)}
                        className="text-xs px-2 py-1 rounded text-cream/60 hover:text-cream"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

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
                      className={cn(
                        "w-full justify-start text-left font-normal bg-cream/5 border-cream/10 text-cream hover:bg-cream/10 hover:text-cream",
                        !date && "text-cream/60"
                      )}
                    >
                      {date ? (
                        format(date, "PPP")
                      ) : (
                        <span>{format(new Date(), "PPP")}</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-dark border-cream/10" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(selectedDate) => {
                        setDate(selectedDate || startOfDay(new Date()))
                        setOpenDatePopover(false)
                      }}
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

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={loading} className="bg-cream text-dark hover:bg-cream/90 font-medium">
                {loading ? "Adding..." : "Add Expense"}
                {!loading && <Plus className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </form>
        </MotionContainer>
      </div>
    </main>
  )
}

