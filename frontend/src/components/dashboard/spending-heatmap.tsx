"use client"

import { useState, useEffect, useMemo } from "react"
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../lib/firebase"
import { useExpensesData } from "../../hooks/use-expenses-data"
import { useAuth } from "../../contexts/auth-context"
import { useViewport } from "../../hooks/use-mobile"

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

interface Expense {
  id: string
  amount: number
  date: string
  userId: string
}

export function SpendingHeatmap() {
  const { user } = useAuth()
  const { isMobile, isTablet } = useViewport()
  const today = new Date()
  const startDate = startOfWeek(subWeeks(today, isMobile ? 7 : 11)) // Show fewer weeks on mobile

  // Responsive configuration
  const heatmapConfig = useMemo(() => {
    if (isMobile) {
      return {
        height: 180,
        cellSize: 'h-3 w-3',
        fontSize: 'text-xs',
        weekCount: 8,
        showDayLabels: false,
      }
    } else if (isTablet) {
      return {
        height: 220,
        cellSize: 'h-4 w-4',
        fontSize: 'text-xs',
        weekCount: 10,
        showDayLabels: true,
      }
    } else {
      return {
        height: 300,
        cellSize: 'h-5 w-5',
        fontSize: 'text-xs',
        weekCount: 12,
        showDayLabels: true,
      }
    }
  }, [isMobile, isTablet])

  const { data: expenses = [], isLoading: expensesLoading } = useExpensesData()

  // Process expenses data using useMemo to avoid infinite loops
  const data = useMemo(() => {
    if (!user || !expenses.length) {
      return {}
    }

    try {
      const expensesByDate: Record<string, number> = {}
      ;(expenses as Expense[]).forEach((expense) => {
        const dateKey = format(safeParseDate(expense.date), "yyyy-MM-dd")
        expensesByDate[dateKey] = (expensesByDate[dateKey] || 0) + expense.amount
      })
      return expensesByDate
    } catch (error) {
      return {}
    }
  }, [user, expenses])

  // Generate weeks array (responsive count)
  const weeks = []
  for (let week = 0; week < heatmapConfig.weekCount; week++) {
    const weekDays = []
    for (let day = 0; day < 7; day++) {
      const date = addDays(addWeeks(startDate, week), day)
      const dateKey = format(date, "yyyy-MM-dd")
      weekDays.push({
        date,
        dateKey,
        value: data[dateKey] || 0,
      })
    }
    weeks.push(weekDays)
  }

  // Get color based on value (dynamic based on actual data)
  const getColor = (value: number) => {
    if (value === 0) return "bg-cream/5"
    
    // Find max value for scaling
    const maxValue = Math.max(...Object.values(data))
    if (maxValue === 0) return "bg-cream/5"
    
    const intensity = value / maxValue
    if (intensity < 0.25) return "bg-cream/10"
    if (intensity < 0.5) return "bg-cream/20"
    if (intensity < 0.75) return "bg-cream/30"
    return "bg-cream/40"
  }

  // Day labels
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  if (expensesLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: heatmapConfig.height }}>
        <div className="text-cream/60">Loading spending data...</div>
      </div>
    )
  }

  return (
    <div className="overflow-auto" style={{ height: heatmapConfig.height }}>
      <div className="flex">
        {heatmapConfig.showDayLabels && (
          <div className="w-8 mr-2">
            {dayLabels.map((day, index) => (
              <div key={day} className={`${heatmapConfig.cellSize.split(' ')[0]} text-xs text-cream/40 flex items-center justify-end`}>
                {index % 2 === 0 ? day : ""}
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-x-auto">
          <div className="flex">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col mr-1">
                {week.map((day) => (
                  <div
                    key={day.dateKey}
                    className={`${heatmapConfig.cellSize} rounded-sm ${getColor(day.value)} m-[1px] cursor-pointer hover:ring-1 hover:ring-cream/40`}
                    title={`${format(day.date, "MMM d, yyyy")}: $${day.value.toFixed(2)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className={`flex justify-between mt-2 ${heatmapConfig.fontSize} text-cream/40`}>
            <span>{format(startDate, isMobile ? "MMM" : "MMM d")}</span>
            <span>{format(today, isMobile ? "MMM" : "MMM d")}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end mt-4">
        <div className={`${heatmapConfig.fontSize} text-cream/60 mr-2`}>Less</div>
        <div className="flex">
          <div className={`${heatmapConfig.cellSize.replace('h-', 'h-').replace('w-', 'w-')} bg-cream/5 rounded-sm`}></div>
          <div className={`${heatmapConfig.cellSize.replace('h-', 'h-').replace('w-', 'w-')} bg-cream/10 rounded-sm ml-1`}></div>
          <div className={`${heatmapConfig.cellSize.replace('h-', 'h-').replace('w-', 'w-')} bg-cream/20 rounded-sm ml-1`}></div>
          <div className={`${heatmapConfig.cellSize.replace('h-', 'h-').replace('w-', 'w-')} bg-cream/30 rounded-sm ml-1`}></div>
          <div className={`${heatmapConfig.cellSize.replace('h-', 'h-').replace('w-', 'w-')} bg-cream/40 rounded-sm ml-1`}></div>
        </div>
        <div className={`${heatmapConfig.fontSize} text-cream/60 ml-2`}>More</div>
      </div>
    </div>
  )
}

