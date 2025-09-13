/**
 * Production-ready Error Boundary component
 * Prevents crashes in critical UI sections and provides fallback UI
 */

"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '../../lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
  showError?: boolean
}

interface State {
  hasError: boolean
  errorMessage?: string
  errorStack?: string
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true,
      errorMessage: error.message,
      errorStack: error.stack
    }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { name = 'Unknown Component' } = this.props

    // Log error to Sentry instead of console
    logger.error(`Error Boundary caught error in ${name}`, {
      error: error.message,
      stack: error.stack,
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
      return (
        <div className="flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center">
            <div className="text-red-600 text-lg font-semibold mb-2">
              Something went wrong
            </div>
            <div className="text-red-500 text-sm mb-4">
              We've encountered an unexpected error. Our team has been notified.
            </div>
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </button>
            {this.props.showError && process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-red-400 cursor-pointer">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-red-400 bg-red-100 p-2 rounded overflow-auto max-h-32">
                  {this.state.errorMessage}
                  {this.state.errorStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook version for functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

/**
 * Specialized error boundaries for critical sections
 */

export const DashboardErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    name="Dashboard"
    fallback={
      <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-600 text-lg font-semibold mb-2">
            Dashboard Unavailable
          </div>
          <div className="text-gray-500 text-sm mb-4">
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
      <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 text-sm mb-2">Chart unavailable</div>
          <div className="text-xs text-gray-400">Unable to load visualization</div>
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
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="text-yellow-800 text-sm font-medium mb-1">
          Form Error
        </div>
        <div className="text-yellow-700 text-xs">
          Please refresh the page and try again. If the problem persists, contact support.
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)
