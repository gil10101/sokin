'use client'

import { useEffect } from 'react'
import { setupConnectivityMonitoring } from '../lib/api-utils'
import { identifyUser } from '../lib/sentry'
import { useAuth } from '../contexts/auth-context'

/**
 * AppInitializer component handles initialization tasks:
 * - Sets up connectivity monitoring
 * - Initializes error tracking
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

  // No UI is rendered during normal operation
  return null
} 