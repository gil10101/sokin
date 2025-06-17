'use client'

import { useEffect } from 'react'
import { setupConnectivityMonitoring } from '../lib/api-utils'
import { identifyUser } from '../lib/sentry'
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
      identifyUser('anonymous')
    }
  }, [user])

  // Setup backend connectivity monitoring
  useEffect(() => {
    const cleanupConnectivityMonitoring = setupConnectivityMonitoring()
    
    // Cleanup the interval when the component unmounts
    return () => {
      cleanupConnectivityMonitoring()
    }
  }, [])

  // Initialize Firebase Cloud Messaging for push notifications
  useEffect(() => {
    let mounted = true
    
    const initializeFCM = async () => {
      try {
        // Only initialize FCM if user is authenticated and component is still mounted
        if (user && mounted) {
          await initializeMessaging()
          console.log('Firebase Cloud Messaging initialized successfully')
        }
      } catch (error) {
        console.error('Failed to initialize Firebase Cloud Messaging:', error)
        // Continue silently - FCM is not critical for core app functionality
      }
    }

    // Initialize FCM when user becomes available
    if (user) {
      initializeFCM()
    }

    return () => {
      mounted = false
    }
  }, [user])

  // No UI is rendered during normal operation
  return null
} 