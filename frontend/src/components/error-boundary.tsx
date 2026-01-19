'use client'

/**
 * Production-ready Error Boundary component
 * Prevents crashes in critical UI sections and provides fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { captureError } from '@/lib/sentry'
import { Button } from './ui/button'
import { useRouter } from 'next/navigation'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
  showError?: boolean
}

interface State {
  hasError: boolean
  error?: Error
  errorStack?: string
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true,
      error,
      errorStack: error.stack
    }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { name = 'Unknown Component' } = this.props
    
    // Log error to Sentry
    captureError(error, { 
      componentStack: errorInfo.componentStack,
      errorBoundary: name 
    })
  }

  public override render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return <ErrorFallback error={this.state.error} showError={this.props.showError} />
    }

    return this.props.children
  }
}

function ErrorFallback({ error, showError }: { error?: Error; showError?: boolean }) {
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark p-4 text-cream">
      <h1 className="mb-4 text-2xl font-medium">Something went wrong</h1>
      <p className="mb-8 text-cream/60">
        {error?.message || 'An unexpected error occurred'}
      </p>
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => router.refresh()}
        >
          Refresh Page
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push('/')}
        >
          Go Home
        </Button>
      </div>
      {showError && process.env.NODE_ENV === 'development' && error?.stack && (
        <details className="mt-4 text-left max-w-2xl">
          <summary className="text-xs text-cream/40 cursor-pointer">
            Error Details (Development Only)
          </summary>
          <pre className="mt-2 text-xs text-cream/40 bg-dark/50 p-2 rounded overflow-auto max-h-32">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  )
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`
  
  return WithErrorBoundaryComponent
}

/**
 * Specialized error boundaries for critical sections
 */

export const DashboardErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    name="Dashboard"
    fallback={
      <div className="flex items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="text-gray-600 dark:text-gray-300 text-lg font-semibold mb-2">
            Dashboard Unavailable
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Unable to load your dashboard. Please refresh the page.
          </div>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)

export const ChartErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    name="Chart"
    fallback={
      <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400 text-sm mb-2">Chart unavailable</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">Unable to load visualization</div>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)

export const FormErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    name="Form"
    fallback={
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
        <div className="text-yellow-800 dark:text-yellow-200 text-sm font-medium mb-1">
          Form Error
        </div>
        <div className="text-yellow-700 dark:text-yellow-300 text-xs">
          Please refresh the page and try again. If the problem persists, contact support.
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)
