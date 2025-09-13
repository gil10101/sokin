"use client"

import React, { useEffect } from "react"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to monitoring (Sentry integrated via global logger in app)
    // Avoid console usage in production; Next.js will surface error overlay in dev
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-red-50">
      <div className="max-w-md w-full bg-white shadow-sm rounded-lg p-6 text-center border border-red-200">
        <h1 className="text-xl font-semibold text-red-600 mb-2">Something went wrong</h1>
        <p className="text-sm text-red-500 mb-4">An unexpected error occurred. Please try again.</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  )
}


