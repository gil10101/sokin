'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark p-4 text-cream">
      <h1 className="mb-4 text-2xl font-medium">404 - Page Not Found</h1>
      <p className="mb-8 text-cream/60">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-cream/20 text-cream hover:border-cream hover:bg-cream/5 h-10 px-4 py-2 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Home
        </Link>
      </div>
    </div>
  )
} 