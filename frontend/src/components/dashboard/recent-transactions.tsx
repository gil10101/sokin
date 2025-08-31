"use client"

import { useState, useEffect } from "react"
import { ShoppingBag, Coffee, Home, Car, Utensils, LucideIcon } from "lucide-react"
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useAuth } from "../../contexts/auth-context"
import { format } from "date-fns"

// Helper function to safely parse dates including Firebase Timestamps
const safeParseDate = (dateValue: string | number | Date | { toDate(): Date } | null | undefined): Date => {
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

interface Transaction {
  id: string
  name: string
  amount: number
  date: string
  category: string
  description?: string
  userId: string
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

export function RecentTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchRecentTransactions()
    }
  }, [user])

  const fetchRecentTransactions = async () => {
    if (!user) return

    setLoading(true)
    try {
      const expensesRef = collection(db, "expenses")
      const q = query(
        expensesRef,
        where("userId", "==", user.uid),
        orderBy("date", "desc"),
        limit(7)
      )

      const querySnapshot = await getDocs(q)
      const transactionsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Transaction[]

      setTransactions(transactionsData)
    } catch (error) {

      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-cream/5 animate-pulse">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-cream/10 mr-4" />
              <div>
                <div className="h-4 w-24 bg-cream/10 rounded mb-1" />
                <div className="h-3 w-16 bg-cream/10 rounded" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-4 w-16 bg-cream/10 rounded mb-1" />
              <div className="h-3 w-12 bg-cream/10 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="text-cream/60 mb-2">No recent transactions</div>
          <div className="text-sm text-cream/40">Add some expenses to see them here</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => {
        const IconComponent = getCategoryIcon(transaction.category)
        const transactionDate = safeParseDate(transaction.date)
        
        return (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-cream/5 transition-colors"
          >
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-cream/5 flex items-center justify-center mr-4">
                <IconComponent className="h-5 w-5 text-cream/60" />
              </div>
              <div>
                <p className="font-medium text-sm">{transaction.name}</p>
                <p className="text-xs text-cream/60">
                  {format(transactionDate, "MMM d, h:mm a")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-sm">${transaction.amount.toFixed(2)}</p>
              <p className="text-xs text-cream/60">{transaction.category}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

