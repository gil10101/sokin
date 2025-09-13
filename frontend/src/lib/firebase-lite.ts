/**
 * Lightweight Firebase utilities with tree-shaking optimization
 * Only imports the specific Firebase modules we need
 */

// Import only the specific functions we use to reduce bundle size
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type DocumentSnapshot
} from 'firebase/firestore'

import { db } from './firebase'

/**
 * Optimized Firestore utilities with consistent error handling
 * Reduces repetitive code and provides better tree-shaking
 */
export const firestoreUtils = {
  /**
   * Generic collection query with automatic error handling
   */
  async queryCollection<T = DocumentData>(
    collectionName: string,
    userId: string,
    additionalFilters?: Array<{
      field: string
      operator: any
      value: any
    }>,
    sorting?: {
      field: string
      direction: 'asc' | 'desc'
    },
    maxResults?: number
  ): Promise<T[]> {
    try {
      const collectionRef = collection(db, collectionName)
      let q = query(collectionRef, where('userId', '==', userId))

      // Add additional filters
      if (additionalFilters) {
        additionalFilters.forEach(filter => {
          q = query(q, where(filter.field, filter.operator, filter.value))
        })
      }

      // Add sorting
      if (sorting) {
        q = query(q, orderBy(sorting.field, sorting.direction))
      }

      // Add limit
      if (maxResults) {
        q = query(q, limit(maxResults))
      }

      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[]
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error)
      return []
    }
  },

  /**
   * Get expenses for a user within date range
   */
  async getExpenses(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const filters = []
    
    if (startDate) {
      filters.push({
        field: 'date',
        operator: '>=',
        value: Timestamp.fromDate(startDate)
      })
    }
    
    if (endDate) {
      filters.push({
        field: 'date',
        operator: '<=',
        value: Timestamp.fromDate(endDate)
      })
    }

    return this.queryCollection('expenses', userId, filters, {
      field: 'date',
      direction: 'desc'
    })
  },

  /**
   * Get budgets for a user
   */
  async getBudgets(userId: string) {
    return this.queryCollection('budgets', userId, undefined, {
      field: 'category',
      direction: 'asc'
    })
  },

  /**
   * Get savings goals for a user
   */
  async getSavingsGoals(userId: string) {
    return this.queryCollection('goals', userId, undefined, {
      field: 'createdAt',
      direction: 'desc'
    })
  },

  /**
   * Generic document operations
   */
  async getDocument<T = DocumentData>(
    collectionName: string, 
    docId: string
  ): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, docId)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T
      }
      return null
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error)
      return null
    }
  },

  async createDocument(
    collectionName: string,
    data: any
  ) {
    try {
      const collectionRef = collection(db, collectionName)
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      return docRef.id
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error)
      throw error
    }
  },

  async updateDocument(
    collectionName: string,
    docId: string,
    data: any
  ) {
    try {
      const docRef = doc(db, collectionName, docId)
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error)
      throw error
    }
  },

  async deleteDocument(
    collectionName: string,
    docId: string
  ) {
    try {
      const docRef = doc(db, collectionName, docId)
      await deleteDoc(docRef)
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error)
      throw error
    }
  }
}

/**
 * Usage Examples:
 * 
 * // Instead of writing custom queries everywhere:
 * const expenses = await firestoreUtils.getExpenses(userId, startDate, endDate)
 * const budgets = await firestoreUtils.getBudgets(userId)
 * 
 * // Generic queries:
 * const notifications = await firestoreUtils.queryCollection('notifications', userId, 
 *   [{ field: 'read', operator: '==', value: false }])
 */
