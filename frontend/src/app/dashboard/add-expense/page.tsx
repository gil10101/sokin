"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { collection, addDoc, getDocs } from "firebase/firestore"
import { db } from "../../../lib/firebase"
import { useAuth } from "../../../contexts/auth-context"
import { format } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown, Plus } from "lucide-react"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { Input } from "../../../components/ui/input"
import { Button } from "../../../components/ui/button"
import { Textarea } from "../../../components/ui/textarea"
import { Calendar } from "../../../components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../../components/ui/command"
import { useToast } from "../../../hooks/use-toast"
import { MotionContainer } from "../../../components/ui/motion-container"
import { ReceiptScanner } from "../../../components/dashboard/receipt-scanner"

// Import the useNotifications hook
import { useNotifications } from "../../../contexts/notifications-context"

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

export default function AddExpensePage() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Add the useNotifications hook to the component
  const { addNotification } = useNotifications()

  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState<Date>(new Date())
  const [category, setCategory] = useState("")
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [loading, setLoading] = useState(false)
  const [openCategoryPopover, setOpenCategoryPopover] = useState(false)
  const [openDatePopover, setOpenDatePopover] = useState(false)
  const [receiptImageUrl, setReceiptImageUrl] = useState("")
  const [receiptData, setReceiptData] = useState<any>(null)

  useEffect(() => {
    // Fetch categories from Firestore
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

        // If we couldn't fetch any categories, use the defaults
        setCategories(DEFAULT_CATEGORIES)
      } catch (error) {
        console.error("Error fetching categories:", error)
        // Use default categories if there's an error
        setCategories(DEFAULT_CATEGORIES)
      }
    }

    fetchCategories()
  }, [user])

  const handleReceiptData = (data: any) => {
    // Auto-fill form with receipt data
    if (data.suggestedName) setName(data.suggestedName)
    if (data.amount) setAmount(data.amount.toString())
    if (data.suggestedCategory) setCategory(data.suggestedCategory)
    if (data.suggestedDescription) setDescription(data.suggestedDescription)
    if (data.date) {
      try {
        setDate(new Date(data.date))
      } catch (e) {
        // Keep current date if parsing fails
      }
    }
    if (data.imageUrl) setReceiptImageUrl(data.imageUrl)
    if (data) setReceiptData(data)
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

    setLoading(true)

    try {
      // Add expense to Firestore
      await addDoc(collection(db, "expenses"), {
        userId: user.uid,
        name,
        amount: Number.parseFloat(amount),
        description: description || null,
        category,
        date: date.toISOString(),
        receiptImageUrl: receiptImageUrl || '',
        receiptData: receiptData || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      toast({
        title: "Expense added",
        description: "Your expense has been added successfully",
      })

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
      setDate(new Date())
      setReceiptImageUrl("")
      setReceiptData(null)

      // Redirect to expenses page
      router.push("/dashboard/expenses")
    } catch (error: any) {
      toast({
        title: "Error adding expense",
        description: error.message || "There was an error adding your expense",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

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
    </div>
  )
}

