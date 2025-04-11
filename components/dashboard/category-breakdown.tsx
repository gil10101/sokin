"use client"

import { useEffect, useState, useMemo } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChevronRight, X, Calendar, Filter, ShoppingBag, Coffee, Home, Car, Utensils, ArrowDown, LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"

// Define data outside of component to prevent recreation on render
const categoryData = [
  { name: "Dining", value: 840, color: "rgba(245, 245, 240, 0.9)" },
  { name: "Shopping", value: 620, color: "rgba(245, 245, 240, 0.7)" },
  { name: "Transport", value: 480, color: "rgba(245, 245, 240, 0.5)" },
  { name: "Utilities", value: 350, color: "rgba(245, 245, 240, 0.3)" },
  { name: "Other", value: 280, color: "rgba(245, 245, 240, 0.1)" },
]

// Define transaction type
interface Transaction {
  name: string
  date: string
  amount: number
  icon: LucideIcon
}

// Define the transactions by category type
type CategoryTransactions = {
  [key: string]: Transaction[]
}

// Sample transactions data
const transactionsByCategory: CategoryTransactions = {
  "Dining": [
    { name: "Starbucks Coffee", date: "Apr 15, 10:30 AM", amount: 5.75, icon: Coffee },
    { name: "Restaurant Dinner", date: "Apr 12, 7:30 PM", amount: 62.80, icon: Utensils },
    { name: "Lunch Cafe", date: "Apr 10, 1:15 PM", amount: 18.25, icon: Coffee },
    { name: "Pizza Delivery", date: "Apr 8, 6:45 PM", amount: 24.99, icon: Utensils },
    { name: "Breakfast Bagel", date: "Apr 5, 8:20 AM", amount: 7.50, icon: Coffee },
  ],
  "Shopping": [
    { name: "Amazon Purchase", date: "Apr 14, 2:15 PM", amount: 34.99, icon: ShoppingBag },
    { name: "Clothing Store", date: "Apr 11, 3:30 PM", amount: 89.95, icon: ShoppingBag },
    { name: "Bookstore", date: "Apr 7, 5:45 PM", amount: 42.50, icon: ShoppingBag },
  ],
  "Transport": [
    { name: "Uber Ride", date: "Apr 13, 8:45 AM", amount: 12.50, icon: Car },
    { name: "Gas Station", date: "Apr 9, 4:30 PM", amount: 45.75, icon: Car },
    { name: "Train Ticket", date: "Apr 6, 9:15 AM", amount: 22.00, icon: Car },
  ],
  "Utilities": [
    { name: "Electricity Bill", date: "Apr 12, 12:00 PM", amount: 85.20, icon: Home },
    { name: "Internet Bill", date: "Apr 5, 10:30 AM", amount: 65.99, icon: Home },
  ],
  "Other": [
    { name: "Gym Membership", date: "Apr 10, 9:00 AM", amount: 45.00, icon: Home },
    { name: "Mobile App Subscription", date: "Apr 7, 11:20 AM", amount: 9.99, icon: Home },
  ]
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

export function CategoryBreakdown() {
  const [mounted, setMounted] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState("30days")
  const [showDateFilter, setShowDateFilter] = useState(false)
  const router = useRouter()
  
  // Memoize total calculation to prevent recalculation on each render
  const total = useMemo(() => categoryData.reduce((sum, item) => sum + item.value, 0), [])
  
  // Memoize formatCurrency function
  const formatCurrency = useMemo(() => (value: number) => `$${value.toLocaleString()}`, [])
  
  // Calculate percentages for each category
  const categoriesWithPercentages = useMemo<CategoryWithPercentage[]>(() => 
    categoryData.map(category => ({
      ...category,
      percentage: Math.round((category.value / total) * 100)
    })), 
    [total]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-[300px] bg-cream/5 animate-pulse rounded-md" />
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
    // Render expanded view as a separate full-screen component
    return (
      <div className="fixed inset-0 z-50 bg-[#1A1A1A] overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-cream/10">
            <h3 className="text-lg font-medium text-cream">Spending by Category</h3>
            <button
              onClick={toggleExpanded}
              className="text-cream/60 hover:text-cream flex items-center transition-colors duration-200"
            >
              <X className="h-4 w-4 mr-1" />
              <span className="text-sm">Close</span>
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            {/* Date filter */}
            <div className="mb-4">
              <div className="relative inline-block">
                <button 
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className="flex items-center bg-cream/5 rounded-lg px-3 py-2 text-sm hover:bg-cream/10 transition-colors duration-200"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {dateRangeOptions.find(option => option.value === dateRange)?.label}
                  <ArrowDown className="h-3 w-3 ml-2" />
                </button>
                
                {showDateFilter && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1E1E1E] border border-cream/10 rounded-lg shadow-lg py-1 z-10 w-full">
                    {dateRangeOptions.map((option) => (
                      <button
                        key={option.value}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-cream/5 transition-colors duration-200 ${
                          dateRange === option.value ? 'text-cream font-medium' : 'text-cream/70'
                        }`}
                        onClick={() => {
                          setDateRange(option.value)
                          setShowDateFilter(false)
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Main content */}
            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* Left side: Charts */}
              <div className="w-3/5 flex flex-col">
                {/* Pie Chart */}
                <div className="h-[45%] mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        onMouseEnter={onPieEnter}
                        onMouseLeave={onPieLeave}
                        isAnimationActive={mounted}
                        animationBegin={0}
                        animationDuration={1000}
                        animationEasing="ease-out"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke={activeIndex === index || selectedCategory === entry.name ? "#FFFFFF" : "transparent"}
                            strokeWidth={2}
                            onClick={() => selectCategory(entry.name)}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 26, 0.95)",
                          border: "1px solid rgba(245, 245, 240, 0.2)",
                          borderRadius: "8px",
                          color: "#F5F5F0",
                          padding: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Bar Chart */}
                <div className="h-[45%]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoriesWithPercentages}>
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
                        formatter={(value: number) => [`$${value}`, "Amount"]}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 26, 0.95)",
                          border: "1px solid rgba(245, 245, 240, 0.2)",
                          borderRadius: "8px",
                          color: "#F5F5F0",
                          padding: "8px",
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
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
              </div>
              
              {/* Right side: Category details */}
              <div className="w-2/5 overflow-hidden">
                <h4 className="text-base font-medium mb-3 text-cream">
                  Category Breakdown
                </h4>
                
                <div className="space-y-3 overflow-y-auto h-[calc(100%-32px)] pr-2">
                  {categoriesWithPercentages.map((category, index) => (
                    <div 
                      key={index} 
                      className={`bg-cream/5 rounded-lg p-3 cursor-pointer transition-all duration-300 ${
                        selectedCategory === category.name ? 'border border-cream/40' : 'hover:bg-cream/10'
                      }`}
                      onClick={() => selectCategory(category.name)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: category.color }} />
                          <span className="text-sm font-medium text-cream">{category.name}</span>
                        </div>
                        <span className="text-sm font-medium text-cream">${category.value}</span>
                      </div>
                      
                      <div className="w-full bg-cream/5 rounded-full h-2 mb-2">
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
                        <div className="mt-3 pt-3 border-t border-cream/10 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-cream/5 rounded-lg p-2 transform transition-all duration-300 delay-100">
                              <div className="text-xs text-cream/60">Total Spent</div>
                              <div className="text-lg font-medium text-cream">${category.value}</div>
                            </div>
                            <div className="bg-cream/5 rounded-lg p-2 transform transition-all duration-300 delay-150">
                              <div className="text-xs text-cream/60">% of Budget</div>
                              <div className="text-lg font-medium text-cream">{category.percentage}%</div>
                            </div>
                          </div>
                          
                          <h5 className="text-sm font-medium text-cream transform transition-all duration-300 delay-200">Recent Transactions</h5>
                          <div className="space-y-2 max-h-[180px] overflow-y-auto">
                            {transactionsByCategory[category.name]?.map((transaction: Transaction, idx: number) => (
                              <div 
                                key={idx} 
                                className="bg-cream/5 rounded-lg p-2 flex items-center justify-between hover:bg-cream/10 transition-colors duration-200 transform transition-all duration-300"
                                style={{ transitionDelay: `${200 + idx * 50}ms` }}
                              >
                                <div className="flex items-center">
                                  <div className="h-8 w-8 rounded-full bg-cream/10 flex items-center justify-center mr-2">
                                    <transaction.icon className="h-4 w-4 text-cream/60" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-cream">{transaction.name}</p>
                                    <p className="text-xs text-cream/60">{transaction.date}</p>
                                  </div>
                                </div>
                                <p className="text-sm font-medium text-cream">${transaction.amount.toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-3 pt-3 border-t border-cream/10 flex justify-between items-center">
                    <span className="text-sm font-medium text-cream">Total</span>
                    <span className="text-sm font-medium text-cream">${total}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render collapsed view (original)
  return (
    <div className="bg-transparent">
      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              isAnimationActive={mounted}
              animationBegin={0}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke={activeIndex === index ? "#FFFFFF" : "transparent"}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "rgba(26, 26, 26, 0.95)",
                border: "1px solid rgba(245, 245, 240, 0.2)",
                borderRadius: "8px",
                color: "#F5F5F0",
                padding: "8px",
              }}
            />
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              formatter={(value) => {
                return <span className="text-cream/80 text-sm">{value}</span>
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Categories List */}
      <div className="mt-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
          {categoryData.map((category, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: category.color }} />
                <span className="text-sm text-cream/80">{category.name}</span>
              </div>
              <span className="text-sm font-medium text-cream">${category.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 pt-2 border-t border-cream/10 flex justify-between items-center">
          <span className="text-sm font-medium text-cream">Total</span>
          <span className="text-sm font-medium text-cream">${total}</span>
        </div>

        <button
          onClick={toggleExpanded}
          className="mt-2 w-full text-center text-xs text-cream/60 hover:text-cream flex items-center justify-center group transition-colors duration-200"
        >
          View detailed breakdown
          <ChevronRight className="h-3 w-3 ml-1 transform group-hover:translate-x-1 transition-transform duration-300" />
        </button>
      </div>
    </div>
  )
}

