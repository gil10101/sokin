"use client"

import { useEffect, useState, useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChevronRight, X, Calendar, Filter, ShoppingBag, Coffee, Home, Car, Utensils, ArrowDown, LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useExpensesData } from "../../hooks/use-expenses-data"
import { useAuth } from "../../contexts/auth-context"
import { useViewport } from "../../hooks/use-mobile"
import { format, subDays, isAfter } from "date-fns"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: any): Date => {
  if (!dateValue) return new Date()
  
  try {
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue
    }
    // If it's a Firebase Timestamp object
    else if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
      return dateValue.toDate()
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

// Define transaction type
interface Transaction {
  id: string
  name: string
  date: string
  amount: number
  category: string
  description?: string
  userId: string
}

interface CategoryTransactions {
  [key: string]: Transaction[]
}

// Define expense type
interface Expense {
  id: string
  name: string
  amount: number
  date: string
  category: string
  description?: string
  userId: string
}

// Date range options
const dateRangeOptions = [
  { label: "Last 7 days", value: "7days" },
  { label: "Last 30 days", value: "30days" },
  { label: "Last 3 months", value: "3months" },
  { label: "Last 6 months", value: "6months" },
  { label: "Year to date", value: "ytd" },
]

// Type for category data with percentage
interface CategoryWithPercentage {
  name: string
  value: number
  color: string
  percentage: number
}

// Default category colors
const getCategoryColor = (index: number) => {
  const opacities = [0.9, 0.7, 0.5, 0.3, 0.1]
  return `rgba(245, 245, 240, ${opacities[index % opacities.length]})`
}

// Get icon for category
const getCategoryIcon = (category: string): LucideIcon => {
  const categoryIcons: Record<string, LucideIcon> = {
    dining: Utensils,
    food: Coffee,
    shopping: ShoppingBag,
    transport: Car,
    utilities: Home,
    housing: Home,
    entertainment: Coffee,
    health: Home,
    travel: Car,
    other: Home,
  }
  
  return categoryIcons[category.toLowerCase()] || Home
}

export function CategoryBreakdown() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState("30days")
  const [categoryData, setCategoryData] = useState<CategoryWithPercentage[]>([])
  const [transactionsByCategory, setTransactionsByCategory] = useState<CategoryTransactions>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'distribution' | 'comparison'>('distribution')
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: expenses = [], isLoading: expensesLoading } = useExpensesData()

  useEffect(() => {
    if (user && mounted && !expensesLoading) {
      processCategoryData()
    }
  }, [user, mounted, dateRange, expensesLoading, expenses])

  const processCategoryData = () => {
    if (!user) return

    setLoading(true)
    try {
      const endDate = new Date()
      let startDate = new Date()

      switch (dateRange) {
        case "7days":
          startDate = subDays(endDate, 7)
          break
        case "30days":
          startDate = subDays(endDate, 30)
          break
        case "3months":
          startDate = subDays(endDate, 90)
          break
        case "6months":
          startDate = subDays(endDate, 180)
          break
        case "ytd":
          startDate = new Date(endDate.getFullYear(), 0, 1)
          break
        default:
          startDate = subDays(endDate, 30)
      }

      const filteredExpenses = (expenses as Expense[]).filter((expense) => {
        const expenseDate = safeParseDate(expense.date)
        return isAfter(expenseDate, startDate) || expenseDate.getTime() === startDate.getTime()
      })

      const categoryTotals: Record<string, number> = {}
      const txByCategory: CategoryTransactions = {}

      filteredExpenses.forEach((expense) => {
        const category = expense.category || "Other"
        categoryTotals[category] = (categoryTotals[category] || 0) + expense.amount
        if (!txByCategory[category]) {
          txByCategory[category] = []
        }
        txByCategory[category].push(expense)
      })

      const total = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0)

      const categoryArray = Object.entries(categoryTotals)
        .map(([name, value], index) => ({
          name,
          value,
          color: getCategoryColor(index),
          percentage: total > 0 ? Math.round((value / total) * 100) : 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)

      setCategoryData(categoryArray)
      setTransactionsByCategory(txByCategory)
    } catch (error) {
      setCategoryData([])
      setTransactionsByCategory({})
    } finally {
      setLoading(false)
    }
  }
  
  // Memoize total calculation to prevent recalculation on each render
  const total = useMemo(() => categoryData.reduce((sum, item) => sum + item.value, 0), [categoryData])
  
  // Memoize formatCurrency function
  const formatCurrency = useMemo(() => (value: number) => `$${value.toLocaleString()}`, [])

  if (!mounted) {
    return <div className="h-[300px] bg-cream/5 animate-pulse rounded-md" />
  }

  if (loading) {
    return (
      <div className="min-h-[400px] sm:h-[300px] flex items-center justify-center">
        <div className="text-cream/60 text-sm">Loading category data...</div>
      </div>
    )
  }

  if (categoryData.length === 0) {
    return (
      <div className="min-h-[400px] sm:h-[300px] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-cream/60 mb-2 text-sm sm:text-base">No expense data available</div>
          <div className="text-xs sm:text-sm text-cream/40">Add some expenses to see category breakdown</div>
        </div>
      </div>
    )
  }

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const onPieLeave = () => {
    setActiveIndex(null)
  }
  
  const toggleExpanded = () => {
    setExpanded(!expanded)
    if (!expanded) {
      setSelectedCategory(null)
    }
  }
  
  const selectCategory = (category: string) => {
    setSelectedCategory(category === selectedCategory ? null : category)
  }

  if (expanded) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-7xl max-h-[95vh] bg-dark rounded-xl border border-cream/10 overflow-hidden shadow-2xl my-4">
          <div className="p-4 md:p-8 h-full flex flex-col max-h-[95vh]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 lg:mb-8 gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <h3 className="text-base lg:text-lg font-medium font-outfit">Category Breakdown</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center text-cream/60 text-sm hover:text-cream bg-cream/5 px-3 py-1.5 rounded-md border border-cream/10">
                    {dateRangeOptions.find(option => option.value === dateRange)?.label}
                    <ChevronRight className="h-4 w-4 ml-2 transform rotate-90" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-dark border-cream/10">
                    {dateRangeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        className="text-cream hover:bg-cream/10 cursor-pointer"
                        onClick={() => setDateRange(option.value)}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                onClick={toggleExpanded}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-cream/10 text-cream/60 hover:text-cream hover:bg-cream/15 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 flex-1 overflow-hidden">
              {/* Left side: Charts */}
              <div className="w-full lg:w-3/5 bg-cream/5 rounded-lg p-4 lg:p-6 flex flex-col min-h-0 flex-shrink-0">
                {/* Tab Navigation */}
                <div className="flex flex-col sm:flex-row mb-4 lg:mb-6 gap-2">
                  <button
                    onClick={() => setActiveTab('distribution')}
                    className={`px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                      activeTab === 'distribution'
                        ? 'bg-cream/20 text-cream border border-cream/30'
                        : 'bg-cream/5 text-cream/70 hover:bg-cream/10 hover:text-cream'
                    }`}
                  >
                    Category Distribution
                  </button>
                  <button
                    onClick={() => setActiveTab('comparison')}
                    className={`px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                      activeTab === 'comparison'
                        ? 'bg-cream/20 text-cream border border-cream/30'
                        : 'bg-cream/5 text-cream/70 hover:bg-cream/10 hover:text-cream'
                    }`}
                  >
                    Spending Comparison
                  </button>
                </div>

                {/* Chart Container */}
                <div className="h-[180px] lg:flex-1 lg:min-h-0 mb-4 lg:mb-0 flex-shrink-0">
                  {activeTab === 'distribution' && (
                    <div className="h-[200px] lg:h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            onMouseEnter={onPieEnter}
                            onMouseLeave={onPieLeave}
                          >
                            {categoryData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color}
                                stroke={activeIndex === index ? "#F5F5F0" : "none"}
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                  <div className="bg-dark border border-cream/10 p-2 rounded-md shadow-md">
                                    <p className="text-cream font-medium">{data.name}</p>
                                    <p className="text-cream/80 text-sm">${data.value.toFixed(2)}</p>
                                    <p className="text-cream/60 text-xs">{data.percentage}% of total</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {activeTab === 'comparison' && (
                    <div className="h-[200px] lg:h-full">
                      <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          vertical={false} 
                          stroke="rgba(245, 245, 240, 0.1)" 
                          horizontal={true}
                        />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: 'rgba(245, 245, 240, 0.7)', fontSize: 12 }} 
                          axisLine={{ stroke: 'rgba(245, 245, 240, 0.1)' }}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fill: 'rgba(245, 245, 240, 0.7)', fontSize: 12 }} 
                          axisLine={{ stroke: 'rgba(245, 245, 240, 0.1)' }}
                          tickLine={false}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                          formatter={(value: number) => [`$${value.toFixed(2)}`, "Amount"]}
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #000000",
                            borderRadius: "8px",
                            color: "#000000",
                            padding: "8px",
                            fontWeight: "bold",
                            boxShadow: "0 4px 8px rgba(0,0,0,0.5)"
                          }}
                          labelStyle={{ color: "#000000", fontWeight: "bold" }}
                          cursor={{ fill: "#252525" }}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[4, 4, 0, 0]}
                          maxBarSize={35}
                          animationDuration={1000}
                          animationEasing="ease-out"
                          onMouseEnter={(data, index) => {
                            const bars = document.querySelectorAll('.recharts-bar-rectangle');
                            bars.forEach((bar, i) => {
                              if (i !== index) {
                                (bar as HTMLElement).style.opacity = '0.5';
                              }
                            });
                          }}
                          onMouseLeave={() => {
                            const bars = document.querySelectorAll('.recharts-bar-rectangle');
                            bars.forEach(bar => {
                              (bar as HTMLElement).style.opacity = '1';
                            });
                          }}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={selectedCategory === entry.name ? "rgba(245, 245, 240, 0.4)" : "rgba(245, 245, 240, 0.2)"}
                              cursor="pointer"
                              onClick={() => selectCategory(entry.name)}
                              style={{
                                transition: 'all 0.3s ease-in-out',
                                transform: selectedCategory === entry.name ? 'scale(1.05)' : 'scale(1)',
                                transformOrigin: 'bottom',
                              }}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right side: Category details */}
              <div className="w-full lg:w-2/5 flex flex-col min-h-0">
                <h4 className="text-lg font-medium mb-4 lg:mb-6 text-cream">
                  Category Details
                </h4>
                
                <div className="space-y-4 overflow-y-auto flex-1 pr-3 min-h-0">
                  {categoryData.map((category, index) => (
                                          <div 
                        key={index} 
                        className={`bg-cream/5 rounded-lg p-4 cursor-pointer transition-all duration-300 ${
                          selectedCategory === category.name ? 'border border-cream/40' : 'hover:bg-cream/10'
                        }`}
                        onClick={() => selectCategory(category.name)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="h-4 w-4 rounded-full mr-3" style={{ backgroundColor: category.color }} />
                            <span className="text-sm font-medium text-cream">{category.name}</span>
                          </div>
                          <span className="text-sm font-medium text-cream">${category.value.toFixed(2)}</span>
                        </div>
                        
                        <div className="w-full bg-cream/5 rounded-full h-2 mb-3">
                          <div 
                            className="h-2 rounded-full transition-all duration-300" 
                            style={{ 
                              backgroundColor: category.color, 
                              width: `${category.percentage}%` 
                            }}
                          />
                        </div>
                        
                        <div className="flex justify-between items-center">
                        <span className="text-xs text-cream/60">{category.percentage}% of total</span>
                        <span className="text-xs text-cream/60">
                          {transactionsByCategory[category.name]?.length || 0} transactions
                        </span>
                      </div>
                      
                      <div 
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          selectedCategory === category.name ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="mt-4 pt-4 border-t border-cream/10 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-cream/5 rounded-lg p-3 transform transition-all duration-300 delay-100">
                              <div className="text-xs text-cream/60 mb-1">Total Spent</div>
                              <div className="text-lg font-medium text-cream">${category.value.toFixed(2)}</div>
                            </div>
                            <div className="bg-cream/5 rounded-lg p-3 transform transition-all duration-300 delay-150">
                              <div className="text-xs text-cream/60 mb-1">% of Total</div>
                              <div className="text-lg font-medium text-cream">{category.percentage}%</div>
                            </div>
                          </div>
                          
                          <h5 className="text-sm font-medium text-cream transform transition-all duration-300 delay-200 mb-3">Recent Transactions</h5>
                          <div className="space-y-3 max-h-[200px] overflow-y-auto">
                            {transactionsByCategory[category.name]?.slice(0, 5).map((transaction, idx) => {
                              const IconComponent = getCategoryIcon(transaction.category)
                              return (
                                <div 
                                  key={transaction.id} 
                                  className="bg-cream/5 rounded-lg p-3 flex items-center justify-between hover:bg-cream/10 transition-colors duration-200 transform transition-all duration-300"
                                  style={{ transitionDelay: `${200 + idx * 50}ms` }}
                                >
                                  <div className="flex items-center">
                                    <div className="h-10 w-10 rounded-full bg-cream/10 flex items-center justify-center mr-3">
                                      <IconComponent className="h-5 w-5 text-cream/60" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-cream mb-1">{transaction.name}</p>
                                      <p className="text-xs text-cream/60">
                                        {format(safeParseDate(transaction.date), "MMM d, h:mm a")}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-sm font-medium text-cream">${transaction.amount.toFixed(2)}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-6 pt-4 border-t border-cream/10 flex justify-between items-center">
                    <span className="text-base font-medium text-cream">Total</span>
                    <span className="text-base font-medium text-cream">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[400px] sm:h-[300px] flex flex-col">
      {/* Chart Container */}
      <div className="h-[200px] sm:h-[180px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
            >
              {categoryData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke={activeIndex === index ? "#F5F5F0" : "none"}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-dark border border-cream/10 p-2 rounded-md shadow-md">
                      <p className="text-cream font-medium text-sm">{data.name}</p>
                      <p className="text-cream/80 text-xs">${data.value.toFixed(2)}</p>
                      <p className="text-cream/60 text-xs">{data.percentage}% of total</p>
                    </div>
                  )
                }
                return null
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Category Legend */}
      <div className="flex-1 flex flex-col mt-3 sm:mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-2 mb-3 sm:mb-2 flex-1">
          {categoryData.map((category, index) => (
            <div key={index} className="flex items-center justify-between min-w-0">
              <div className="flex items-center min-w-0 flex-1">
                <div className="h-3 w-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: category.color }} />
                <span className="text-xs sm:text-sm text-cream/80 truncate">{category.name}</span>
              </div>
              <span className="text-xs sm:text-sm font-medium text-cream ml-2 flex-shrink-0">${category.value.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-cream/10 flex justify-between items-center">
          <span className="text-sm font-medium text-cream">Total</span>
          <span className="text-sm font-medium text-cream">${total.toFixed(2)}</span>
        </div>

        {/* Expand Button */}
        <button
          onClick={toggleExpanded}
          className="mt-3 sm:mt-4 w-full text-center text-xs text-cream/60 hover:text-cream flex items-center justify-center group transition-colors duration-200 py-1"
        >
          View detailed breakdown
          <ChevronRight className="h-3 w-3 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
        </button>
      </div>
    </div>
  )
}

