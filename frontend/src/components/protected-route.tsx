"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { LoadingSpinner } from "./ui/loading-spinner"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (!loading && !user && !hasRedirected.current) {
      hasRedirected.current = true
      router.replace("/login")
    }
  }, [user, loading, router])

  // Reset if user logs back in
  useEffect(() => {
    if (user) {
      hasRedirected.current = false
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
