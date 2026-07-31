"use client"

import type React from "react"
import { useCallback, useLayoutEffect, useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { MobileNav } from "@/components/mobile-nav"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardErrorBoundary } from "@/components/error-boundary"

const SIDEBAR_COLLAPSED_STORAGE_KEY = "sokin:sidebar-collapsed"

/**
 * The sidebar lives here rather than in each page so that navigating between
 * dashboard routes never unmounts it: App Router keeps the layout mounted and
 * only swaps the page beneath it. That also makes this the only sensible owner
 * of the collapsed flag, since page-local state would reset on every nav.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  /**
   * Read before paint, not during render: the server has no localStorage, so
   * seeding useState from it would produce a hydration mismatch. useLayoutEffect
   * commits the stored value in the same frame the sidebar first paints, so the
   * user never sees the sidebar flip from expanded to collapsed.
   */
  useLayoutEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true")
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Expanded is fine.
    }
  }, [])

  const handleCollapsedChange = useCallback((next: boolean) => {
    setCollapsed(next)
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
    } catch {
      // Non-fatal: the preference just won't survive a reload.
    }
  }, [])

  return (
    <ProtectedRoute>
      <DashboardErrorBoundary>
        <div className="flex h-screen bg-dark text-cream overflow-hidden">
          <MobileNav />
          <DashboardSidebar collapsed={collapsed} setCollapsed={handleCollapsedChange} />
          {/*
            pt-16 reserves room for MobileNav's fixed top-4 left-4 trigger so no
            page has to remember to indent its own heading. flex-col + overflow-hidden
            gives the page's `<main className="flex-1 overflow-auto">` a definite
            height to scroll inside.
          */}
          <div className="flex-1 flex flex-col overflow-hidden pt-16 md:pt-0">
            {children}
          </div>
        </div>
      </DashboardErrorBoundary>
    </ProtectedRoute>
  )
}
