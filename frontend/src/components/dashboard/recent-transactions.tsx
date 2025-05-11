"use client"

import { ShoppingBag, Coffee, Home, Car, Utensils } from "lucide-react"

export function RecentTransactions() {
  return (
    <div className="space-y-4">
      {transactions.map((transaction, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-cream/5 transition-colors"
        >
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-cream/5 flex items-center justify-center mr-4">
              <transaction.icon className="h-5 w-5 text-cream/60" />
            </div>
            <div>
              <p className="font-medium text-sm">{transaction.name}</p>
              <p className="text-xs text-cream/60">{transaction.date}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-sm">${transaction.amount.toFixed(2)}</p>
            <p className="text-xs text-cream/60">{transaction.category}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const transactions = [
  {
    name: "Starbucks Coffee",
    date: "Today, 10:30 AM",
    amount: 5.75,
    category: "Dining",
    icon: Coffee,
  },
  {
    name: "Amazon Purchase",
    date: "Yesterday, 2:15 PM",
    amount: 34.99,
    category: "Shopping",
    icon: ShoppingBag,
  },
  {
    name: "Uber Ride",
    date: "Mar 20, 8:45 AM",
    amount: 12.5,
    category: "Transport",
    icon: Car,
  },
  {
    name: "Electricity Bill",
    date: "Mar 19, 12:00 PM",
    amount: 85.2,
    category: "Utilities",
    icon: Home,
  },
  {
    name: "Restaurant Dinner",
    date: "Mar 18, 7:30 PM",
    amount: 62.8,
    category: "Dining",
    icon: Utensils,
  },
]

