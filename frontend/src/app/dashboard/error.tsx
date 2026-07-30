"use client"

import React, { useEffect } from "react"
import { captureError } from "@/lib/sentry"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest, boundary: "dashboard" })
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-cream/5 border border-cream/10 rounded-xl p-6 text-center">
        <h2 className="text-lg font-medium font-outfit mb-2">Dashboard unavailable</h2>
        <p className="text-sm text-cream/60 mb-6">We couldn&apos;t load your dashboard. Please try again.</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-cream text-dark rounded-lg hover:bg-cream/90 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
