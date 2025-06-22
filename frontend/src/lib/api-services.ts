import { auth } from './firebase'

/**
 * Enhanced API Services for Sokin App
 * Production-ready API integration for mobile-first application
 * Supports offline-first architecture with retry mechanisms
 */

// Base API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
const API_TIMEOUT = 10000 // 10 seconds
const MAX_RETRIES = 3

// Simple in-memory cache to reduce API calls
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

const getCachedData = (key: string) => {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

const setCachedData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() })
}

// Request interceptor for authentication
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('User not authenticated')
  }
  
  const token = await user.getIdToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Client-Version': '1.0.0',
    'X-Platform': 'web'
  }
}

// Enhanced fetch with retry logic and rate limit handling
const enhancedFetch = async (
  url: string, 
  options: RequestInit = {}, 
  retries = MAX_RETRIES
): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
  
  // Prepend API_BASE_URL if not already present
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // Handle rate limiting specifically
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}))
      const retryAfter = errorData.retryAfter || Math.pow(2, MAX_RETRIES - retries) // Exponential backoff
      
      if (retries > 0) {
        console.warn(`Rate limited. Retrying in ${retryAfter} seconds... (attempt ${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        return enhancedFetch(url, options, retries - 1)
      } else {
        throw new Error(`Rate limited: ${errorData.error || 'Too many requests'}. Please try again in ${retryAfter} seconds.`)
      }
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
    }
    
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    
    // For non-rate-limit errors, use the original retry logic
    if (retries > 0 && error instanceof Error && error.name !== 'AbortError' && !error.message.includes('Rate limited')) {
      console.warn(`API request failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (MAX_RETRIES - retries + 1)))
      return enhancedFetch(url, options, retries - 1)
    }
    
    throw error
  }
}

// Receipt Processing API
export const receiptAPI = {
  async processReceipt(file: File): Promise<{
    success: boolean
    data?: {
      merchant?: string
      amount?: number
      date?: string
      items?: string[]
      confidence: number
    }
    error?: string
  }> {
    const formData = new FormData()
    formData.append('receipt', file)
    
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error('Authentication required')
    
    const response = await enhancedFetch('/api/receipts/process', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    return response.json()
  }
}

// Savings Goals API
export const goalsAPI = {
  async getGoals(): Promise<any[]> {
    const cacheKey = 'goals'
    const cachedData = getCachedData(cacheKey)
    
    if (cachedData) {
      return cachedData
    }
    
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('/api/goals', {
      method: 'GET',
      headers
    })
    
    const data = await response.json()
    const goals = data.goals || []
    
    // Cache the results
    setCachedData(cacheKey, goals)
    
    return goals
  },
  
  async createGoal(goal: {
    name: string
    targetAmount: number
    currentAmount?: number
    deadline?: string
    category?: string
  }): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('/api/goals', {
      method: 'POST',
      headers,
      body: JSON.stringify(goal)
    })
    
    // Invalidate cache after creating a goal
    cache.delete('goals')
    
    return response.json()
  },
  
  async updateGoal(goalId: string, updates: any): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`/api/goals/${goalId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })
    
    // Invalidate cache after updating a goal
    cache.delete('goals')
    
    return response.json()
  },
  
  async deleteGoal(goalId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`/api/goals/${goalId}`, {
      method: 'DELETE',
      headers
    })
    
    // Invalidate cache after deleting a goal
    cache.delete('goals')
  }
}

// Bill Reminders API
export const billRemindersAPI = {
  async getBillReminders(): Promise<any[]> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('/api/bill-reminders', {
      method: 'GET',
      headers
    })
    
    const data = await response.json()
    return data.bills || []
  },
  
  async createBillReminder(bill: {
    name: string
    amount: number
    dueDate: string
    frequency: 'once' | 'weekly' | 'monthly' | 'yearly'
    category?: string
    notes?: string
  }): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('/api/bill-reminders', {
      method: 'POST',
      headers,
      body: JSON.stringify(bill)
    })
    
    return response.json()
  },
  
  async updateBillReminder(billId: string, updates: any): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`/api/bill-reminders/${billId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })
    
    return response.json()
  },
  
  async markBillPaid(billId: string, paidDate: string): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`/api/bill-reminders/${billId}/pay`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ paidDate })
    })
    
    return response.json()
  },
  
  async deleteBillReminder(billId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`/api/bill-reminders/${billId}`, {
      method: 'DELETE',
      headers
    })
  }
}

// Notifications API
export const notificationsAPI = {
  async registerFCMToken(token: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch('/api/notifications/fcm-token', {
      method: 'POST',
      headers,
      body: JSON.stringify({ token })
    })
  },
  
  async getNotificationPreferences(): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('/api/notifications/preferences', {
      method: 'GET',
      headers
    })
    
    return response.json()
  },
  
  async updateNotificationPreferences(preferences: any): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('/api/notifications/preferences', {
      method: 'PUT',
      headers,
      body: JSON.stringify(preferences)
    })
    
    return response.json()
  }
}

// Analytics API
export const analyticsAPI = {
  async getSpendingInsights(timeframe: string = '30days'): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`/api/analytics/insights?timeframe=${timeframe}`, {
      method: 'GET',
      headers
    })
    
    return response.json()
  },
  
  async getCategoryBreakdown(timeframe: string = '30days'): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`/api/analytics/categories?timeframe=${timeframe}`, {
      method: 'GET',
      headers
    })
    
    return response.json()
  },
  
  async getBudgetProgress(): Promise<any> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('/api/analytics/budget-progress', {
      method: 'GET',
      headers
    })
    
    return response.json()
  }
}

// Health check for API connectivity
export const healthAPI = {
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

// Export consolidated API object
export const API = {
  receipts: receiptAPI,
  goals: goalsAPI,
  billReminders: billRemindersAPI,
  notifications: notificationsAPI,
  analytics: analyticsAPI,
  health: healthAPI
}

export default API 