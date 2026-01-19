"use client"

import React from "react"
import { usePortfolioState } from "@/hooks/use-portfolio-state"

interface ResponsiveLayoutContainerProps {
  stockMarketSection: React.ReactNode
  savingsAnalyticsSection: React.ReactNode
  recentTransactionsSection: React.ReactNode
  billsSection?: React.ReactNode
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
  billsSection,
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
          
          {/* Right Column: Bills (desktop only) | Savings & Analytics */}
          <div className="flex flex-col space-y-4 lg:space-y-6">
            {billsSection && <div className="hidden lg:block">{billsSection}</div>}
            {savingsAnalyticsSection}
          </div>
        </div>
        
        {/* Bills on mobile/tablet */}
        {billsSection && <div className="lg:hidden mb-6 lg:mb-8">{billsSection}</div>}
      </div>
    )
  }

  // Standard Layout: When user has portfolio
  return (
    <div className={className}>
      {/* Desktop: 2-column layout with equal heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8 lg:items-stretch">
        {/* Left Column: Stock Market | Recent Transactions */}
        <div className="flex flex-col space-y-4 lg:space-y-6">
          <div className="flex-[2] flex flex-col min-h-0">
            {stockMarketSection}
          </div>
          <div className="flex-1 flex flex-col min-h-0">
            {recentTransactionsSection}
          </div>
        </div>

        {/* Right Column: Bills (desktop only) | Savings Goals | Analytics Overview */}
        <div className="flex flex-col space-y-4 lg:space-y-6">
          {billsSection && <div className="hidden lg:block">{billsSection}</div>}
          {savingsAnalyticsSection}
        </div>
      </div>

      {/* Bills on mobile/tablet */}
      {billsSection && <div className="lg:hidden mb-6 lg:mb-8">{billsSection}</div>}
    </div>
  )
}
