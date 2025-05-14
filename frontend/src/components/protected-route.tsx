"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "../contexts/auth-context"
import { LoadingSpinner } from "./ui/loading-spinner"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Only redirect if we're mounted, not loading, and there's no user
    if (mounted && !loading && !user && !redirecting) {
      setRedirecting(true)
      router.push("/login")
    }
  }, [user, loading, router, mounted, redirecting])

  // Don't render anything until client-side
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If we're redirecting, show loading
  if (redirecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
        <span className="ml-4 text-cream/60">Redirecting to login...</span>
      </div>
    )
  }

  // Only render children if user is authenticated
  return user ? <>{children}</> : null
}

