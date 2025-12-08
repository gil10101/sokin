"use client"

import { useMemo } from 'react'
import { useViewport } from '../../hooks/use-mobile'
import { format, subMonths, eachDayOfInterval } from 'date-fns'

// Simple card components to avoid React 19 type conflicts
interface SimpleCardProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

const SimpleCard = ({ className, children, ...props }: SimpleCardProps) => (
  <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className || ''}`} {...props}>
    {children}
  </div>
)

const SimpleCardHeader = ({ className, children, ...props }: SimpleCardProps) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className || ''}`} {...props}>
    {children}
  </div>
)

const SimpleCardTitle = ({ className, children, ...props }: SimpleCardProps) => (
  <div className={`text-2xl font-semibold leading-none tracking-tight ${className || ''}`} {...props}>
    {children}
  </div>
)

const SimpleCardContent = ({ className, children, ...props }: SimpleCardProps) => (
  <div className={`p-6 pt-0 ${className || ''}`} {...props}>
    {children}
  </div>
)

interface Expense {
  id: string
  name: string
  amount: number
  date: string
  category: string
  userId: string
}

interface SpendingHeatmapAnalyticsProps {
  expenses?: Expense[]
}

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

export function SpendingHeatmapAnalytics({ expenses }: SpendingHeatmapAnalyticsProps) {
  const { isMobile, isTablet } = useViewport()

  // Process spending data for heatmap
  const spendingHeatmapData = useMemo(() => {
    // Ensure expenses is always an array
    const safeExpenses = expenses || []
    
    const endDate = new Date()
    const startDate = subMonths(endDate, 12)
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate })
    
    const dailySpending = dateRange.map(date => {
      const dayExpenses = safeExpenses.filter(expense => {
        // Validate and sanitize the expense date
        if (!expense.date) return false
        
        const expenseDate = safeParseDate(expense.date)
        // Check if the date is valid
        if (isNaN(expenseDate.getTime())) return false
        
        try {
          return format(expenseDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        } catch (error) {

          return false
        }
      })
      
      const totalSpent = dayExpenses.reduce((sum, expense) => sum + Math.abs(expense.amount || 0), 0)
      
      return {
        date: format(date, 'yyyy-MM-dd'),
        day: format(date, 'dd'),
        month: format(date, 'MMM'),
        year: format(date, 'yyyy'),
        amount: totalSpent,
        count: dayExpenses.length
      }
    })
    
    return dailySpending
  }, [expenses])

  return (
    <SimpleCard className="bg-cream/5 border-cream/20">
      <SimpleCardHeader className="pb-6">
        <SimpleCardTitle className="text-xl text-cream/90">Spending Heatmap</SimpleCardTitle>
        <p className="text-sm text-cream/60">Daily spending patterns over the last {isMobile ? '5 weeks' : isTablet ? '6 weeks' : '7 weeks'}</p>
      </SimpleCardHeader>
      <SimpleCardContent className="pb-6">
        <div className="space-y-4">
          <div className={`grid grid-cols-7 gap-3 ${isMobile ? 'text-xs' : isTablet ? 'text-xs' : 'text-sm'} max-w-4xl mx-auto`}>
            {(() => {
              const dayLabels = isMobile 
                ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] 
                : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              return dayLabels.map((day, index) => (
                <div key={index} className={`flex items-center justify-center font-medium text-cream/60 ${isMobile ? 'p-2' : isTablet ? 'p-2.5' : 'p-3'}`}>{day}</div>
              ))
            })()}
            {spendingHeatmapData.slice(isMobile ? -35 : isTablet ? -42 : -49).map((day, index) => {
              const intensity = Math.min(day.amount / 100, 1) // Normalize intensity
              return (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex items-center justify-center ${isMobile ? 'text-xs' : isTablet ? 'text-xs' : 'text-sm'} cursor-pointer hover:scale-105 transition-all duration-200 font-medium`}
                  style={{
                    backgroundColor: `rgba(245, 245, 240, ${intensity * 0.6 + 0.1})`,
                    color: intensity > 0.3 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(245, 245, 240, 0.7)',
                    border: '1px solid rgba(245, 245, 240, 0.2)',
                    minHeight: isMobile ? '32px' : isTablet ? '40px' : '48px'
                  }}
                  title={`${day.date}: $${day.amount.toFixed(2)} (${day.count} transactions)`}
                >
                  {isMobile ? day.day.slice(-1) : day.day}
                </div>
              )
            })}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center space-x-4 pt-4 max-w-md mx-auto">
            <span className="text-xs text-cream/60">Less</span>
            <div className="flex space-x-1">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity, index) => (
                <div 
                  key={index}
                  className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} rounded-sm border border-cream/20`}
                  style={{ backgroundColor: `rgba(245, 245, 240, ${intensity * 0.6 + 0.1})` }}
                />
              ))}
            </div>
            <span className="text-xs text-cream/60">More</span>
          </div>
        </div>
      </SimpleCardContent>
    </SimpleCard>
  )
}
