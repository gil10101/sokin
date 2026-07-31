"use client"

import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react"
import {
  type User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { logger } from "@/lib/logger"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { clearApiCache } from "@/lib/api"
import { StockAPI } from "@/lib/stock-api"

interface UserData {
  name: string
  email: string
  createdAt: string
  settings: {
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

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (name: string, email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  userData: UserData | null
  refreshUserData: () => Promise<void>
  updateUserSettings: (settings: Partial<UserData['settings']>) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  userData: null,
  refreshUserData: async () => {},
  updateUserSettings: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

const getApiBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_API_URL environment variable is not configured')
  }
  const normalized = baseUrl.replace(/\/+$/, '')
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

const apiRequest = async <T,>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error('User not authenticated')
  }

  const token = await currentUser.getIdToken()
  const baseUrl = getApiBaseUrl()

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    let errorMessage = `API request failed: ${response.status}`
    try {
      const data = await response.json()
      errorMessage = data.error || errorMessage
    } catch {
    }
    throw new Error(errorMessage)
  }

  const contentType = response.headers.get('content-type')
  if (response.status === 204 || 
      response.headers.get('content-length') === '0' ||
      !contentType?.includes('application/json')) {
    return null as T
  }

  return await response.json()
}

// AuthProvider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const queryClient = useQueryClient()
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * The profile carries the user's settings (currency, preferences), so a
   * failed fetch silently renders the whole app with defaults. Retry transient
   * failures rather than accepting the first error.
   */
  const fetchUserProfile = async (userId: string, attempt = 0): Promise<UserData | null> => {
    const MAX_ATTEMPTS = 3

    try {
      const response = await apiRequest<{ success: boolean; data: UserData }>(
        `/users/${userId}`
      )
      return response.data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      if (attempt < MAX_ATTEMPTS - 1) {
        const backoffMs = 500 * 2 ** attempt
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
        return fetchUserProfile(userId, attempt + 1)
      }

      logger.error("Profile fetch failed - falling back to default settings", {
        error: message,
        userId,
        attempts: MAX_ATTEMPTS,
      })
      return null
    }
  }

  const createUserProfile = async (userId: string, name: string, email: string): Promise<UserData | null> => {
    try {
      const response = await apiRequest<{ success: boolean; data: UserData }>(
        '/users',
        {
          method: 'POST',
          body: JSON.stringify({ name, email }),
        }
      )
      return response.data
    } catch (error) {
      logger.error("Profile create failed", {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      })
      throw error
    }
  }

  const refreshUserData = useCallback(async (): Promise<void> => {
    if (!user) return

    const profile = await fetchUserProfile(user.uid)
    if (profile) {
      setUserData(profile)
    }
  }, [user])

  const updateUserSettings = useCallback(async (settings: Partial<UserData['settings']>): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      const response = await apiRequest<{ success: boolean; data: UserData }>(
        `/users/${user.uid}`,
        {
          method: 'PUT',
          body: JSON.stringify({ settings }),
        }
      )
      setUserData(response.data)
    } catch (error) {
      logger.error("Settings update failed", {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.uid
      })
      throw error
    }
  }, [user])

  useEffect(() => {
    // Fallback so the app never hangs on the loading screen if Firebase
    // fails to initialize. Long (30s) on purpose: flipping loading=false
    // before onAuthStateChanged has restored the session makes
    // ProtectedRoute eject a signed-in user to /login on slow cold starts.
    timeoutRef.current = setTimeout(() => {
      logger.error("Auth state resolution timed out")
      setLoading(false)
    }, 30000)

    // Only set up the listener once
    unsubscribeRef.current = onAuthStateChanged(auth, async (currentUser) => {
      // Auth state resolved - the fallback timeout is no longer needed
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      setUser(currentUser)

      if (currentUser) {
        // Fetch user profile from backend API
        const profile = await fetchUserProfile(currentUser.uid)
        if (profile) {
          setUserData(profile)
        }
      } else {
        setUserData(null)
      }

      setLoading(false)
    })

    // Clean up the listener and timeout
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    // Create Firebase auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const firebaseUser = userCredential.user

    try {
      // Update Firebase profile with display name
      await updateProfile(firebaseUser, {
        displayName: name,
      })

      // Create user profile via backend API
      // This ensures all user data goes through the backend
      const profile = await createUserProfile(firebaseUser.uid, name, email)
      if (profile) {
        setUserData(profile)
      }

      router.push("/dashboard")
    } catch (error) {
      logger.error("Sign up error", {
        error: error instanceof Error ? error.message : 'Unknown error',
        email
      })
      // The auth account was created but the backend profile was not.
      // Delete the orphan so the user can retry signup - otherwise every
      // retry fails with auth/email-already-in-use against a half-created
      // account.
      await firebaseUser.delete().catch(() => {
        logger.error("Failed to roll back orphaned auth account", { email })
      })
      throw error
    }
  }, [router])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push("/dashboard")
    } catch (error) {
      logger.error("Sign in error", {
        error: error instanceof Error ? error.message : 'Unknown error',
        email
      })
      throw error
    }
  }, [router])

  const signOut = useCallback(async () => {
    // Drop every cache layer that may hold the outgoing user's data,
    // so the next sign-in on this browser cannot see it.
    const clearClientCaches = async () => {
      queryClient.clear()
      clearApiCache()
      StockAPI.clearCache()
      if (typeof caches !== "undefined") {
        try {
          const keys = await caches.keys()
          await Promise.all(keys.map((key) => caches.delete(key)))
        } catch {
          // Cache Storage unavailable (e.g. insecure context) — nothing to clear
        }
      }
    }

    try {
      await firebaseSignOut(auth)
      setUserData(null)
      await clearClientCaches()
      router.push("/")
    } catch (error) {
      logger.error("Sign out error", {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Still clear caches and redirect even if sign out fails
      await clearClientCaches().catch(() => {})
      router.push("/")
    }
  }, [router, queryClient])

  const value = useMemo(() => ({
    user,
    loading,
    signUp,
    signIn,
    signOut,
    userData,
    refreshUserData,
    updateUserSettings,
  }), [user, loading, signUp, signIn, signOut, userData, refreshUserData, updateUserSettings])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
