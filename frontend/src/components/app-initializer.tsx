'use client'

import { useEffect, useState } from 'react'
import { checkApplicationConfiguration, setupConnectivityMonitoring } from '../lib/api-utils'
import { identifyUser } from '../lib/sentry'
import { useAuth } from '../contexts/auth-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert'
import { AlertTriangle } from 'lucide-react'

/**
 * AppInitializer component handles initialization tasks:
 * - Checks configuration
 * - Sets up connectivity monitoring
 * - Initializes error tracking
 */
export function AppInitializer() {
  const [configErrors, setConfigErrors] = useState<string[]>([])
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const { user } = useAuth()

  // Check application configuration on initial load
  useEffect(() => {
    const { valid, missingVars } = checkApplicationConfiguration()
    if (!valid) {
      console.error('Missing environment variables:', missingVars)
      setConfigErrors(missingVars)
      setShowConfigDialog(true)
    }
  }, [])
  
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

  // No UI is rendered in normal operation
  // Only show configuration warnings if there are issues
  if (configErrors.length === 0) {
    return null
  }

  return (
    <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
      <DialogContent className="bg-dark border-cream/10 text-cream">
        <DialogHeader>
          <DialogTitle className="text-xl">Configuration Warning</DialogTitle>
          <DialogDescription className="text-cream/60">
            The application is missing some required configuration values.
          </DialogDescription>
        </DialogHeader>
        
        <Alert className="border-amber-400/20 bg-amber-400/10">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertTitle className="text-amber-400">Missing Environment Variables</AlertTitle>
          <AlertDescription className="text-cream/60">
            The following environment variables are missing:
            <ul className="mt-2 list-disc pl-5 text-sm">
              {configErrors.map(variable => (
                <li key={variable}>{variable}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm">
              Please check the README for setup instructions or contact the administrator.
            </p>
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  )
} 