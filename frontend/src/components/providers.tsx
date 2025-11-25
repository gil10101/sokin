'use client'

import type React from 'react'
import { useEffect } from 'react'
import { ErrorBoundary } from './error-boundary'
import { ThemeProvider } from './theme-provider'
import { AuthProvider } from '../contexts/auth-context'
import { Toaster } from './ui/toaster'
import { TooltipProvider } from './ui/tooltip'
import { ReactQueryClientProvider } from '../lib/react-query-provider'
import { AppInitializer } from './app-initializer'
import { PerformanceMonitor } from './performance-monitor'

export function Providers({ children }: { children: React.ReactNode }) {
  // Suppress React DevTools console messages
  useEffect(() => {
    if (typeof window === 'undefined' || !window.console) {
      return
    }

    const originalWarn = console.warn
    const originalLog = console.log
    const originalInfo = console.info
    
    const filterMessages = (method: 'warn' | 'log' | 'info') => {
      const original = method === 'warn' ? originalWarn : method === 'log' ? originalLog : originalInfo
      return function(...args: any[]) {
        const firstArg = args[0]
        // Filter React DevTools message
        if (
          typeof firstArg === 'string' &&
          (firstArg.includes('Download the React DevTools') ||
           firstArg.includes('%cDownload the React DevTools'))
        ) {
          return
        }
        // Filter styled DevTools console messages
        const shouldSuppressStyledMessages = 
          process.env.NODE_ENV === 'production' ||
          process.env.NEXT_PUBLIC_SUPPRESS_DEVTOOLS_STYLED_LOGS === 'true'
        
        if (shouldSuppressStyledMessages) {
          const isDevToolsMessage = typeof firstArg === 'string' && (
            firstArg.includes('React DevTools') ||
            firstArg.includes('Download the React DevTools') ||
            firstArg.toLowerCase().includes('devtools')
          )
          
          if (isDevToolsMessage && args.some(arg => typeof arg === 'string' && arg.toLowerCase().includes('font-weight:bold'))) {
            return
          }
        }
        original.apply(console, args)
      }
    }
    
    console.warn = filterMessages('warn')
    console.log = filterMessages('log')
    console.info = filterMessages('info')
    
    return () => {
      console.warn = originalWarn
      console.log = originalLog
      console.info = originalInfo
    }
  }, [])

  return (
    <ErrorBoundary>
      <ReactQueryClientProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <TooltipProvider>
              <AppInitializer />
              {children}
              <Toaster />
              <PerformanceMonitor />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </ReactQueryClientProvider>
    </ErrorBoundary>
  )
}

