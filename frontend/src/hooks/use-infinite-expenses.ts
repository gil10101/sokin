"use client"

import { useInfiniteQuery } from '@tanstack/react-query'
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/auth-context'

export interface ExpenseLite {
  id: string
  name?: string
  amount: number
  date: any
  category: string
  userId: string
}

interface PageResult {
  docs: ExpenseLite[]
  nextCursor: QueryDocumentSnapshot<DocumentData> | null
}

export function useInfiniteExpenses(pageSize = 25) {
  const { user } = useAuth()

  return useInfiniteQuery<PageResult>({
    queryKey: ['expenses-infinite', user?.uid, pageSize],
    enabled: !!user && !!db,
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    queryFn: async ({ pageParam }) => {
      if (!user || !db) return { docs: [], nextCursor: null }

      const base = [
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(pageSize),
      ] as any[]

      const q = query(
        collection(db, 'expenses'),
        ...(pageParam ? [...base, startAfter(pageParam)] : base)
      )

      const snapshot = await getDocs(q)
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ExpenseLite[]

      return {
        docs,
        nextCursor: snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1] : null,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
  })
}


