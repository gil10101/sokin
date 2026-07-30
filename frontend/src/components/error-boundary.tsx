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
      <div className="flex items-center justify-center min-h-[400px] bg-cream/5 border border-cream/10 rounded-xl">
        <div className="text-center">
          <div className="text-cream text-lg font-medium font-outfit mb-2">
            Dashboard unavailable
          </div>
          <div className="text-cream/60 text-sm mb-6">
            Unable to load your dashboard. Please refresh the page.
          </div>
          <button
            className="px-4 py-2 bg-cream text-dark rounded-lg text-sm font-medium hover:bg-cream/90 transition-colors"
            onClick={() => window.location.reload()}
          >
            Refresh page
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
      <div className="flex items-center justify-center h-64 bg-cream/5 border border-cream/10 rounded-xl">
        <div className="text-center">
          <div className="text-cream/60 text-sm mb-2">Chart unavailable</div>
          <div className="text-xs text-cream/40">Unable to load visualization</div>
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
      <div className="p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl">
        <div className="text-amber-300 text-sm font-medium mb-1">
          Form error
        </div>
        <div className="text-amber-200/80 text-xs">
          Please refresh the page and try again. If the problem persists, contact support.
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)
