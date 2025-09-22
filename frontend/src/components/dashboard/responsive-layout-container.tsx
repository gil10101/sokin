"use client"

import React from "react"
import { usePortfolioState } from "@/hooks/use-portfolio-state"

interface ResponsiveLayoutContainerProps {
  stockMarketSection: React.ReactNode
  savingsAnalyticsSection: React.ReactNode
  recentTransactionsSection: React.ReactNode
  className?: string
}

/**
 * Responsive layout container that adapts based on portfolio state
 * When portfolio is empty, reorganizes layout to make better use of space
 */
export function ResponsiveLayoutContainer({
  stockMarketSection,
  savingsAnalyticsSection,
  recentTransactionsSection,
  className = "",
}: ResponsiveLayoutContainerProps) {
  const portfolioState = usePortfolioState()

  // If portfolio is empty or loading, use compact layout
  const shouldUseCompactLayout = portfolioState.isEmpty && !portfolioState.isLoading

  if (shouldUseCompactLayout) {
    return (
      <div className={className}>
        {/* Compact Layout: 2-column approach */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Left Column: Stock Market & Recent Transactions */}
          <div className="space-y-4 lg:space-y-6">
            {stockMarketSection}
            {recentTransactionsSection}
          </div>
          
          {/* Right Column: Savings & Analytics */}
          <div>
            {savingsAnalyticsSection}
          </div>
        </div>
      </div>
    )
  }

  // Standard Layout: When user has portfolio
  return (
    <div className={className}>
      {/* Row 1: Stock Market (Left), Savings & Analytics (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {/* Stock Market - Left Half */}
        <div>
          {stockMarketSection}
        </div>

        {/* Combined Savings Goals & Analytics - Right Half */}
        <div>
          {savingsAnalyticsSection}
        </div>
      </div>

      {/* Row 2: Recent Transactions (full width) */}
      <div className="grid grid-cols-1 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div>
          {recentTransactionsSection}
        </div>
      </div>
    </div>
  )
}
