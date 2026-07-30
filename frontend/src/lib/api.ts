/**
 * API client for backend operations.
 */

import { auth } from './firebase'

/** Goal/Savings goal structure */
export interface Goal {
  id?: string
  userId: string
  name: string
  description?: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  category: string
  priority: 'low' | 'medium' | 'high'
  isCompleted: boolean
  completedAt?: string
  createdAt: string
  updatedAt?: string
}

/** Bill reminder structure */
export interface BillReminder {
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

/** Bill reminder update payload */
export interface BillReminderUpdate {
  name?: string
  amount?: number
  dueDate?: string
  frequency?: 'once' | 'weekly' | 'monthly' | 'yearly'
  category?: string
  notes?: string
}

/** Notification preferences structure */
export interface NotificationPreferences {
  budgetAlerts: boolean
  billReminders: boolean
  goalMilestones: boolean
  spendingInsights: boolean
  pushNotifications: boolean
  emailNotifications: boolean
  smsNotifications?: boolean
}

/** Spending insight analytics */
export interface SpendingInsight {
  period: string
  totalSpent: number
  categories: CategoryBreakdown[]
  trends: SpendingTrend[]
  insights: string[]
}

/** Category breakdown for analytics */
export interface CategoryBreakdown {
  category: string
  amount: number
  percentage: number
  count: number
}

/** Spending trend data point */
export interface SpendingTrend {
  date: string
  amount: number
}

/** Budget progress summary */
export interface BudgetProgress {
  budgets: BudgetItem[]
  totalBudget: number
  totalSpent: number
  remaining: number
}

/** Individual budget item */
export interface BudgetItem {
  category: string
  budgeted: number
  spent: number
  remaining: number
  percentage: number
}

/** Receipt processing result */
export interface ReceiptProcessingResult {
  success: boolean
  data?: {
    merchant?: string
    amount?: number
    date?: string
    items?: string[]
    confidence: number
  }
  error?: string
}

/** Expense structure */
export interface Expense {
  id: string
  userId: string
  name: string
  amount: number
  category: string
  date: string
  description?: string
  notes?: string
  recurring?: boolean
  createdAt: string
  updatedAt?: string
}

/** Expense creation payload */
export interface CreateExpensePayload {
  name: string
  amount: number
  category: string
  date: string
  description?: string
  notes?: string
  recurring?: boolean
  receiptImageUrl?: string
  receiptData?: {
    merchant?: string | null
    confidence?: number | null
    items?: string[]
    rawText?: string
    [key: string]: unknown
  } | null
}

/** Expense pagination options */
export interface ExpensesPaginationOptions {
  limit?: number
  cursor?: string
  sortOrder?: 'asc' | 'desc'
  sortBy?: 'date' | 'createdAt' | 'amount' | 'name'
  category?: string
  startDate?: string
  endDate?: string
}

/** Paginated response structure */
export interface PaginatedResponse<T> {
  items: T[]
  nextCursor?: string
  hasMore: boolean
  total?: number
}

/** Budget structure */
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export interface Budget {
  id: string
  userId: string
  name: string
  amount: number
  spent?: number
  category?: string
  categories?: string[]
  period: BudgetPeriod
  startDate: string
  endDate?: string | null
  notes?: string | null
  createdAt: string
  updatedAt?: string
  /** Server-computed spend against this budget for the current period */
  currentSpent?: number
  remainingAmount?: number
  isActive?: boolean
}

/** Budget creation payload */
export interface CreateBudgetPayload {
  name: string
  amount: number
  category?: string
  categories?: string[]
  period: BudgetPeriod
  startDate: string
  endDate?: string | null
  notes?: string | null
}

/** App notification structure (distinct from DOM Notification) */
export interface AppNotification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  read: boolean
  dismissed?: boolean
  createdAt: string
  data?: Record<string, unknown>
  link?: string
}

/** Dashboard data structure */
export interface DashboardData {
  expenses: Expense[]
  budgets: Budget[]
  notifications: AppNotification[]
}

/** Subscription structure */
export interface Subscription {
  id?: string
  userId: string
  name: string
  logo?: string
  amount: number
  billingCycle: 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'custom'
  customInterval?: number
  customIntervalUnit?: 'days' | 'weeks' | 'months' | 'years'
  category: string
  startDate: string
  nextPaymentDate: string
  paymentMethod: string
  website?: string | null
  notes?: string | null
  autoRenew: boolean
  createdAt: string
  updatedAt?: string
}

/** User profile structure */
export interface UserProfile {
  id: string
  email: string
  name: string
  createdAt: string
  updatedAt?: string
  settings?: {
    currency: string
    theme: string
    notifications: {
      email: boolean
      push: boolean
      monthlyReport: boolean
      budgetAlerts: boolean
      expenseNotifications?: boolean
    }
  }
}

/** API client options for custom requests */
interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  data?: Record<string, unknown>
  token?: string
}

// -----------------------------------------------------------------------------
// Configuration & Constants
// -----------------------------------------------------------------------------

const API_TIMEOUT = 15000 // 15 seconds
const MAX_RETRIES = 3
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

// Performance metrics for debugging
const apiMetrics = {
  requestCount: 0,
  totalResponseTime: 0,
  errors: 0,
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as Window & { apiMetrics?: typeof apiMetrics }).apiMetrics = apiMetrics
}

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>()

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Get the base API URL from environment configuration
 * @throws {Error} When NEXT_PUBLIC_API_URL is not configured
 */
const getApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL
  
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured')
  }

  // Remove trailing slash first to handle edge cases like "/api/"
  const normalizedUrl = baseUrl.replace(/\/+$/, '')

  // Ensure the base URL always includes /api
  if (!normalizedUrl.endsWith('/api')) {
    return normalizedUrl + '/api'
  }

  return normalizedUrl
}

/**
 * Get authentication headers for API requests
 * @throws {Error} When user is not authenticated
 */
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

/**
 * Retrieve cached data if still valid
 */
const getCachedData = <T>(key: string): T | null => {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

/**
 * Store data in cache with timestamp
 */
const setCachedData = (key: string, data: unknown): void => {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Invalidate specific cache entries
 */
const invalidateCache = (...keys: string[]): void => {
  keys.forEach(key => cache.delete(key))
}

/**
 * Clear all cached data
 */
export const clearApiCache = (): void => {
  cache.clear()
}

// -----------------------------------------------------------------------------
// Enhanced Fetch with Retry Logic
// -----------------------------------------------------------------------------

/**
 * Enhanced fetch with retry logic, timeout, and rate limit handling
 */
const enhancedFetch = async (
  url: string, 
  options: RequestInit = {}, 
  retries = MAX_RETRIES
): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
  
  const baseUrl = getApiBaseUrl()
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}/${url.replace(/^\//, '')}`
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    // Handle rate limiting
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}))
      const retryAfter = errorData.retryAfter || Math.pow(2, MAX_RETRIES - retries)
      
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
        return enhancedFetch(url, options, retries - 1)
      }
      
      throw new Error(`Rate limited: ${errorData.error || 'Too many requests'}. Please try again in ${retryAfter} seconds.`)
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`)
    }
    
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    
    // Retry on network errors with true exponential backoff (1s, 2s, 4s)
    if (retries > 0 && error instanceof Error && 
        error.name !== 'AbortError' && 
        !error.message.includes('Rate limited')) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, MAX_RETRIES - retries)))
      return enhancedFetch(url, options, retries - 1)
    }
    
    throw error
  }
}

// -----------------------------------------------------------------------------
// Core API Client
// -----------------------------------------------------------------------------

/**
 * Core API client for making authenticated requests to the backend
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  { data, token, headers, ...customConfig }: ApiClientOptions = {}
): Promise<T> {
  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    body: data ? JSON.stringify(data) : undefined,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...customConfig,
  }

  const startTime = performance.now()
  apiMetrics.requestCount++

  try {
    // Get the current user's token if not provided
    if (!token && auth.currentUser) {
      const userToken = await auth.currentUser.getIdToken()
      if (userToken) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${userToken}`,
        }
      }
    }

    const baseUrl = getApiBaseUrl()
    const finalUrl = `${baseUrl}/${endpoint.replace(/^\//, '')}`

    const response = await fetch(finalUrl, config)

    // Track response time
    const responseTime = performance.now() - startTime
    apiMetrics.totalResponseTime += responseTime

    // Handle HTTP errors
    if (!response.ok) {
      apiMetrics.errors++
      const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }))
      const errorMessage = errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`
      return Promise.reject(new Error(errorMessage))
    }

    return await response.json()
  } catch (error) {
    apiMetrics.errors++
    return Promise.reject(error)
  }
}

// -----------------------------------------------------------------------------
// Convenience Methods for HTTP Verbs
// -----------------------------------------------------------------------------

/**
 * API convenience methods for different request types
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'POST', data }),

  put: <T = unknown>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'PUT', data }),

  delete: <T = unknown>(endpoint: string, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),

  patch: <T = unknown>(endpoint: string, data: Record<string, unknown>, options?: ApiClientOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'PATCH', data }),
}

// -----------------------------------------------------------------------------
// Receipt Processing API
// -----------------------------------------------------------------------------

export const receiptAPI = {
  /**
   * Process a receipt image for expense extraction
   */
  async processReceipt(file: File): Promise<ReceiptProcessingResult> {
    const formData = new FormData()
    formData.append('receipt', file)
    
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error('Authentication required')
    
    const response = await enhancedFetch('receipts/process', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    return await response.json()
  }
}

// -----------------------------------------------------------------------------
// Savings Goals API
// -----------------------------------------------------------------------------

export const goalsAPI = {
  /**
   * Fetch all savings goals for the current user
   */
  async getGoals(): Promise<Goal[]> {
    const cacheKey = 'goals'
    const cachedData = getCachedData<Goal[]>(cacheKey)
    
    if (cachedData) {
      return cachedData
    }
    
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('goals', {
      method: 'GET',
      headers
    })
    
    const data = await response.json()
    const goals = data.data || []
    
    setCachedData(cacheKey, goals)
    return goals
  },
  
  /**
   * Create a new savings goal
   */
  async createGoal(goal: {
    name: string
    targetAmount: number
    currentAmount?: number
    targetDate?: string
    category?: string
    description?: string
    priority?: 'low' | 'medium' | 'high'
  }): Promise<Goal> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('goals', {
      method: 'POST',
      headers,
      body: JSON.stringify(goal)
    })
    
    const data = await response.json()
    invalidateCache('goals')
    return data.data || data
  },
  
  /**
   * Update an existing savings goal
   */
  async updateGoal(goalId: string, updates: Partial<Goal>): Promise<Goal> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`goals/${goalId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })
    
    const data = await response.json()
    invalidateCache('goals')
    return data.data || data
  },

  /**
   * Add a contribution to an existing savings goal
   */
  async addContribution(goalId: string, contribution: {
    amount: number
    method?: string
    source?: string
    note?: string
  }): Promise<Goal> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`goals/${goalId}/contribute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(contribution)
    })

    const data = await response.json()
    invalidateCache('goals')
    return data.data || data
  },
  
  /**
   * Delete a savings goal
   */
  async deleteGoal(goalId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`goals/${goalId}`, {
      method: 'DELETE',
      headers
    })
    
    invalidateCache('goals')
  }
}

// -----------------------------------------------------------------------------
// Bill Reminders API
// -----------------------------------------------------------------------------

export const billRemindersAPI = {
  /**
   * Fetch all bill reminders for the current user
   */
  async getBillReminders(): Promise<BillReminder[]> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('bill-reminders', {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return data.data || []
  },

  /**
   * Create a new bill reminder
   */
  async createBillReminder(bill: {
    name: string
    amount: number
    dueDate: string
    frequency: 'once' | 'weekly' | 'monthly' | 'yearly'
    category?: string
    notes?: string
  }): Promise<BillReminder> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('bill-reminders', {
      method: 'POST',
      headers,
      body: JSON.stringify(bill)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    return data.data || data
  },

  /**
   * Update an existing bill reminder
   */
  async updateBillReminder(billId: string, updates: BillReminderUpdate): Promise<BillReminder> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`bill-reminders/${billId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    return data.data || data
  },

  /**
   * Mark a bill as paid
   */
  async markBillPaid(billId: string, paidDate: string): Promise<BillReminder> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`bill-reminders/${billId}/pay`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ paidDate })
    })

    const data = await response.json()
    invalidateCache('dashboard')
    return data.data || data
  },

  /**
   * Delete a bill reminder
   */
  async deleteBillReminder(billId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`bill-reminders/${billId}`, {
      method: 'DELETE',
      headers
    })
    invalidateCache('dashboard')
  }
}

// -----------------------------------------------------------------------------
// Notifications API
// -----------------------------------------------------------------------------

export const notificationsAPI = {
  /**
   * Fetch user notifications
   */
  async getNotifications(): Promise<AppNotification[]> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('notifications', {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return data.data || []
  },

  /**
   * Create a notification for the current user
   */
  async createNotification(notification: Omit<AppNotification, 'id' | 'userId' | 'createdAt' | 'read'>): Promise<AppNotification> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('notifications', {
      method: 'POST',
      headers,
      body: JSON.stringify(notification)
    })

    const data = await response.json()
    return data.data || data
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers
    })
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch('notifications/read-all', {
      method: 'PATCH',
      headers
    })
  },

  /**
   * Dismiss a notification
   */
  async dismissNotification(notificationId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`notifications/${notificationId}/dismiss`, {
      method: 'PATCH',
      headers
    })
  },

  /**
   * Dismiss all notifications
   */
  async dismissAllNotifications(): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch('notifications/dismiss-all', {
      method: 'PATCH',
      headers
    })
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`notifications/${notificationId}`, {
      method: 'DELETE',
      headers
    })
  },
  /**
   * Register FCM token for push notifications
   */
  async registerFCMToken(token: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch('notifications/fcm-token', {
      method: 'POST',
      headers,
      body: JSON.stringify({ token, platform: 'web' })
    })
  },

  /**
   * Get user notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('notifications/preferences', {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return data.data || data
  },

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('notifications/preferences', {
      method: 'PUT',
      headers,
      body: JSON.stringify(preferences)
    })

    const data = await response.json()
    return data.data || data
  }
}

// -----------------------------------------------------------------------------
// Analytics API
// -----------------------------------------------------------------------------

export const analyticsAPI = {
  /**
   * Get spending insights for a given timeframe
   */
  async getSpendingInsights(timeframe: string = '30days'): Promise<SpendingInsight> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`analytics/insights?timeframe=${timeframe}`, {
      method: 'GET',
      headers
    })

    return await response.json()
  },

  /**
   * Get category breakdown for expenses
   */
  async getCategoryBreakdown(timeframe: string = '30days'): Promise<CategoryBreakdown[]> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`analytics/categories?timeframe=${timeframe}`, {
      method: 'GET',
      headers
    })

    return await response.json()
  },

  /**
   * Get budget progress summary
   */
  async getBudgetProgress(): Promise<BudgetProgress> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('analytics/budget-progress', {
      method: 'GET',
      headers
    })

    return await response.json()
  }
}

// -----------------------------------------------------------------------------
// Expenses API
// -----------------------------------------------------------------------------

export const expensesAPI = {
  /**
   * Fetch paginated expenses for the current user
   */
  async getExpenses(options: ExpensesPaginationOptions = {}): Promise<PaginatedResponse<Expense>> {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.cursor) params.append('cursor', options.cursor)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.category) params.append('category', options.category)
    if (options.startDate) params.append('startDate', options.startDate)
    if (options.endDate) params.append('endDate', options.endDate)

    const queryString = params.toString()
    const endpoint = queryString ? `expenses?${queryString}` : 'expenses'
    
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(endpoint, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    const normalizeExpense = (expense: Expense) => ({
      ...expense,
      description: expense.description ?? expense.notes
    })
    return {
      items: (data.data || []).map(normalizeExpense),
      nextCursor: data.pagination?.nextCursor || null,
      hasMore: data.pagination?.hasMore ?? false,
      total: data.pagination?.count
    }
  },

  /**
   * Get a single expense by ID
   */
  async getExpenseById(expenseId: string): Promise<Expense> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`expenses/${expenseId}`, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    const expense = data.data || data
    return {
      ...expense,
      description: expense.description ?? expense.notes
    }
  },

  /**
   * Create a new expense
   */
  async createExpense(expense: CreateExpensePayload): Promise<Expense> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('expenses', {
      method: 'POST',
      headers,
      body: JSON.stringify(expense)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    const created = data.data || data
    return {
      ...created,
      description: created.description ?? created.notes
    }
  },

  /**
   * Update an existing expense
   */
  async updateExpense(expenseId: string, updates: Partial<CreateExpensePayload>): Promise<Expense> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`expenses/${expenseId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    const updated = data.data || data
    return {
      ...updated,
      description: updated.description ?? updated.notes
    }
  },

  /**
   * Delete an expense
   */
  async deleteExpense(expenseId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`expenses/${expenseId}`, {
      method: 'DELETE',
      headers
    })
    invalidateCache('dashboard')
  }
}

// -----------------------------------------------------------------------------
// Budgets API
// -----------------------------------------------------------------------------

export const budgetsAPI = {
  /**
   * Fetch all budgets for the current user
   */
  async getBudgets(options: { limit?: number; cursor?: string; period?: string; activeOnly?: boolean } = {}): Promise<PaginatedResponse<Budget>> {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.cursor) params.append('cursor', options.cursor)
    if (options.period) params.append('period', options.period)
    if (options.activeOnly) params.append('activeOnly', 'true')

    const queryString = params.toString()
    const endpoint = queryString ? `budgets?${queryString}` : 'budgets'
    
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(endpoint, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return {
      items: data.data || [],
      nextCursor: data.pagination?.nextCursor || null,
      hasMore: data.pagination?.hasMore ?? false,
      total: data.pagination?.count
    }
  },

  /**
   * Get a single budget by ID
   */
  async getBudgetById(budgetId: string): Promise<Budget> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`budgets/${budgetId}`, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return data.data || data
  },

  /**
   * Create a new budget
   */
  async createBudget(budget: CreateBudgetPayload): Promise<Budget> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('budgets', {
      method: 'POST',
      headers,
      body: JSON.stringify(budget)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    return data.data || data
  },

  /**
   * Update an existing budget
   */
  async updateBudget(budgetId: string, updates: Partial<CreateBudgetPayload>): Promise<Budget> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`budgets/${budgetId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    return data.data || data
  },

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`budgets/${budgetId}`, {
      method: 'DELETE',
      headers
    })
    invalidateCache('dashboard')
  }
}

// -----------------------------------------------------------------------------
// Dashboard API
// -----------------------------------------------------------------------------

export const dashboardAPI = {
  /**
   * Fetch aggregated dashboard data
   */
  async getDashboard(): Promise<DashboardData> {
    const cacheKey = 'dashboard'
    const cachedData = getCachedData<DashboardData>(cacheKey)
    
    if (cachedData) {
      return cachedData
    }
    
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('dashboard', {
      method: 'GET',
      headers
    })

    const data = await response.json()
    const dashboardData = data.data || data
    
    setCachedData(cacheKey, dashboardData)
    return dashboardData
  }
}

// -----------------------------------------------------------------------------
// Subscriptions API
// -----------------------------------------------------------------------------

export const subscriptionsAPI = {
  /**
   * Fetch all subscriptions for the current user
   */
  async getSubscriptions(): Promise<Subscription[]> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('subscriptions', {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return data.data || []
  },

  /**
   * Create a new subscription
   */
  async createSubscription(subscription: Omit<Subscription, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch('subscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify(subscription)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    return data.data || data
  },

  /**
   * Update an existing subscription
   */
  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`subscriptions/${subscriptionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })

    const data = await response.json()
    invalidateCache('dashboard')
    return data.data || data
  },

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    const headers = await getAuthHeaders()
    await enhancedFetch(`subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers
    })
    invalidateCache('dashboard')
  }
}

// -----------------------------------------------------------------------------
// User Profile API
// -----------------------------------------------------------------------------

export const userProfileAPI = {
  /**
   * Get current user profile
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`users/${userId}`, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return data.data || data
  },

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<Omit<UserProfile, 'id' | 'createdAt'>>): Promise<UserProfile> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    })

    const data = await response.json()
    return data.data || data
  },

  /**
   * Get user categories
   */
  async getCategories(userId: string): Promise<string[]> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`users/${userId}/categories`, {
      method: 'GET',
      headers
    })

    const data = await response.json()
    return data.data?.categories || []
  },

  /**
   * Update user categories
   */
  async updateCategories(userId: string, categories: string[]): Promise<string[]> {
    const headers = await getAuthHeaders()
    const response = await enhancedFetch(`users/${userId}/categories`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ categories })
    })

    const data = await response.json()
    return data.data?.categories || categories
  }
}

// -----------------------------------------------------------------------------
// Health Check API
// -----------------------------------------------------------------------------

export const healthAPI = {
  /**
   * Check backend API connectivity with timeout
   */
  async checkHealth(): Promise<boolean> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL
      if (!baseUrl) return false
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      // Use regex anchored to end to prevent domain modification
      const healthUrl = baseUrl.replace(/\/api\/?$/, '/health')
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }
}

// -----------------------------------------------------------------------------
// Consolidated API Export
// -----------------------------------------------------------------------------

/**
 * Unified API object providing access to all service endpoints
 */
export const API = {
  // Core data APIs
  expenses: expensesAPI,
  budgets: budgetsAPI,
  goals: goalsAPI,
  billReminders: billRemindersAPI,
  subscriptions: subscriptionsAPI,
  
  // Feature APIs
  receipts: receiptAPI,
  notifications: notificationsAPI,
  analytics: analyticsAPI,
  dashboard: dashboardAPI,
  
  // User APIs
  userProfile: userProfileAPI,
  
  // Utility APIs
  health: healthAPI,
  
  // Cache utilities
  clearCache: clearApiCache,
}

export default API
