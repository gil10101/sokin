'use client'

import { useEffect } from 'react'
import { setupConnectivityMonitoring } from '../lib/api-utils'
import { identifyUser, clearUserIdentity } from '../lib/sentry'
import { initializeMessaging } from '../lib/firebase-messaging'
import { useAuth } from '../contexts/auth-context'

/**
 * AppInitializer component handles initialization tasks:
 * - Sets up connectivity monitoring
 * - Initializes error tracking
 * - Initializes Firebase Cloud Messaging
 * - Configures push notifications
 */
export function AppInitializer() {
  const { user } = useAuth()
  
  // Initialize Sentry user tracking when user state changes
  useEffect(() => {
    if (user) {
      identifyUser(user.uid, {
        email: user.email || undefined,
        username: user.displayName || undefined,
      })
    } else {
      // Clear user identity when logged out
      // This is important for privacy and tracking accuracy
      clearUserIdentity()
    }
  }, [user])

  // Setup backend connectivity monitoring with lazy initialization
  useEffect(() => {
    // Delay connectivity monitoring by 5 seconds to prioritize initial page load
    const timeoutId = setTimeout(() => {
      const cleanupConnectivityMonitoring = setupConnectivityMonitoring(300000) // 5 minutes instead of 2
      return () => cleanupConnectivityMonitoring()
    }, 5000)

    return () => clearTimeout(timeoutId)
  }, [])

  // Register service worker with lazy loading
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Delay service worker registration by 3 seconds
    const timeoutId = setTimeout(async () => {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (e) {
        // noop
      }
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [])

  // Initialize Firebase Cloud Messaging for push notifications with lazy loading
  useEffect(() => {
    let mounted = true

    const initializeFCM = async () => {
      try {
        // Only initialize FCM if user is authenticated and component is still mounted
        if (user && mounted) {
          await initializeMessaging()
        }
      } catch (error) {
        // Failed to initialize Firebase Cloud Messaging, continuing silently
        // FCM is not critical for core app functionality
      }
    }

    // Delay FCM initialization by 8 seconds and only if user is available
    if (user) {
      const timeoutId = setTimeout(initializeFCM, 8000)
      return () => {
        mounted = false
        clearTimeout(timeoutId)
      }
    }

    return () => {
      mounted = false
    }
  }, [user])

  // No UI is rendered during normal operation
  return null
} 