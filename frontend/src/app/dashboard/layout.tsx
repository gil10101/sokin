import type React from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { MobileNav } from "@/components/mobile-nav"
import { DashboardErrorBoundary } from "@/components/ui/error-boundary"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <DashboardErrorBoundary>
        <div className="flex h-screen bg-dark text-cream">
          <MobileNav />
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </DashboardErrorBoundary>
    </ProtectedRoute>
  )
}

