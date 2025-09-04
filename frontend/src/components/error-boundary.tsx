'use client'

import React from 'react'
import { captureError } from '../lib/sentry'
import { Button } from './ui/button'
import { useRouter } from 'next/navigation'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureError(error, { componentStack: errorInfo.componentStack })
  }

  override render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />
    }

    return this.props.children
  }
}

function ErrorFallback({ error }: { error?: Error }) {
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
    </div>
  )
} 