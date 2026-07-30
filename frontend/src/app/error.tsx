"use client"

import React, { useEffect } from "react"
import { captureError } from "@/lib/sentry"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "app-root" })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-dark text-cream">
      <div className="max-w-md w-full bg-cream/5 border border-cream/10 rounded-xl p-6 text-center">
        <h1 className="text-xl font-medium font-outfit mb-2">Something went wrong</h1>
        <p className="text-sm text-cream/60 mb-6">An unexpected error occurred. Please try again.</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-cream text-dark rounded-lg hover:bg-cream/90 transition-colors text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
