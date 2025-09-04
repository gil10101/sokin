'use client'

/* eslint-disable */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark p-4 text-cream">
      <h1 className="mb-4 text-2xl font-medium">404 - Page Not Found</h1>
      <p className="mb-8 text-cream/60">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex gap-4">


        {/* @ts-ignore - React 19 compatibility */}
        <Button
          variant="outline"
          asChild
        >
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Home
          </Link>
        </Button>
      </div>
    </div>
  )
} 