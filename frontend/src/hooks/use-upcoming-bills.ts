"use client"

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/auth-context'
import { addDays, isBefore, isAfter, parseISO, isWithinInterval } from 'date-fns'

/**
 * Hook for fetching upcoming bills data for analytics cards
 * Returns clean data for display without icon dependencies
 */

interface BillReminder {
  id: string
  userId: string
  name: string
  amount: number
  dueDate: string
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly'
  category?: string
  notes?: string
  isPaid: boolean
  paidDate?: string
  createdAt: string
  updatedAt?: string
}

interface UpcomingBillsData {
  upcomingBills: BillReminder[]
  totalUpcoming: number
  overdueCount: number
  thisWeekCount: number
}

export function useUpcomingBills() {
  const { user } = useAuth()

  return useQuery<UpcomingBillsData>({
    queryKey: ['upcoming-bills', user?.uid],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    queryFn: async () => {
      if (!user) {
        return {
          upcomingBills: [],
          totalUpcoming: 0,
          overdueCount: 0,
          thisWeekCount: 0
        }
      }

      try {
        // Import the API service dynamically to avoid circular dependencies
        const { API } = await import('../lib/api-services')
        const bills = await API.billReminders.getBillReminders() as BillReminder[]

        const now = new Date()
        const nextWeek = addDays(now, 7)
        
        // Filter for unpaid bills
        const unpaidBills = bills.filter(bill => !bill.isPaid)
        
        // Get upcoming bills (next 30 days, excluding overdue bills)
        const thirtyDaysFromNow = addDays(now, 30)
        const upcomingBills = unpaidBills.filter(bill => {
          const dueDate = parseISO(bill.dueDate)
          // Only include bills with dueDate between now and thirtyDaysFromNow (inclusive)
          return isWithinInterval(dueDate, { start: now, end: thirtyDaysFromNow })
        })

        // Count overdue bills
        const overdueCount = unpaidBills.filter(bill => {
          const dueDate = parseISO(bill.dueDate)
          return isBefore(dueDate, now)
        }).length

        // Count bills due this week
        const thisWeekCount = unpaidBills.filter(bill => {
          const dueDate = parseISO(bill.dueDate)
          return isAfter(dueDate, now) && isBefore(dueDate, nextWeek)
        }).length

        // Calculate total amount for upcoming bills
        const totalUpcoming = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0)

        // Sort upcoming bills by due date (earliest first) before limiting to 5
        const sortedUpcomingBills = upcomingBills.sort((a, b) => {
          const dateA = parseISO(a.dueDate)
          const dateB = parseISO(b.dueDate)
          
          // Treat missing/invalid dates as far-future for stable sort
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0
          if (isNaN(dateA.getTime())) return 1
          if (isNaN(dateB.getTime())) return -1
          
          return dateA.getTime() - dateB.getTime()
        })

        return {
          upcomingBills: sortedUpcomingBills.slice(0, 5), // Limit to 5 most urgent bills
          totalUpcoming,
          overdueCount,
          thisWeekCount
        }
      } catch (error) {
        console.error('Error fetching upcoming bills:', error)
        return {
          upcomingBills: [],
          totalUpcoming: 0,
          overdueCount: 0,
          thisWeekCount: 0
        }
      }
    },
  })
}
