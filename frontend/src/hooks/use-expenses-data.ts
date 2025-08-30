"use client"

import { useQuery } from '@tanstack/react-query'
import { collection, query, where, orderBy, limit as fsLimit, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/auth-context'

export interface Expense {
  id: string
  name?: string
  amount: number
  date: string | number | Date | { toDate: () => Date }
  category: string
  description?: string
  userId: string
}

interface UseExpensesOptions {
  limit?: number
}

export function useExpensesData(options: UseExpensesOptions = {}) {
  const { user } = useAuth()

  return useQuery<Expense[]>({
    queryKey: ['expenses', user?.uid, options.limit ?? null],
    enabled: !!user && !!db,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      if (!user || !db) return []

      const expensesRef = collection(db, 'expenses')
      const q = query(
        expensesRef,
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        ...(options.limit ? [fsLimit(options.limit)] : [])
      )

      const snapshot = await getDocs(q)
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Expense[]
    },
  })
}


