"use client"

import React from "react"

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8 bg-gray-50 rounded-lg">
      <div className="max-w-md w-full bg-white shadow-sm rounded-lg p-6 text-center border">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Dashboard unavailable</h2>
        <p className="text-sm text-gray-500 mb-4">We couldn't load your dashboard. Please try again.</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  )
}


