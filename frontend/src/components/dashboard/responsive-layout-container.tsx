"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { PortfolioState } from "@/hooks/use-portfolio-state"

interface ResponsiveLayoutContainerProps {
  stockMarketSection: React.ReactNode
  savingsAnalyticsSection: React.ReactNode
  recentTransactionsSection: React.ReactNode
  billsSection?: React.ReactNode
  className?: string
  portfolioState: PortfolioState
}

/**
 * Adapts the lower dashboard to whether the user holds any stock.
 *
 * This renders ONE tree whose classes vary, never two shaped differently.
 * React reconciles by position, so returning a separate tree for the compact
 * case meant the same child sat at a different nesting depth in each - and the
 * portfolio state necessarily transitions (loading -> resolved) on every mount,
 * so the switch fired every visit. That unmounted and rebuilt the whole lower
 * dashboard mid-paint: the Stock Market widget dropped back to a spinner after
 * it had already rendered, its pagination reset, and it refired its requests.
 *
 * Keep it one tree. Vary `className`, never the structure.
 */
export function ResponsiveLayoutContainer({
  stockMarketSection,
  savingsAnalyticsSection,
  recentTransactionsSection,
  billsSection,
  className = "",
  portfolioState,
}: ResponsiveLayoutContainerProps) {
  // An empty portfolio doesn't need the tall stretched split, so the columns
  // sit at natural height instead.
  const compact = portfolioState.isEmpty && !portfolioState.isLoading

  return (
    <div className={className}>
      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8",
          !compact && "lg:items-stretch"
        )}
      >
        {/* Left column: Stock Market over Recent Transactions */}
        <div className="flex flex-col space-y-4 lg:space-y-6">
          <div className={cn(!compact && "flex-[2] flex flex-col min-h-0")}>
            {stockMarketSection}
          </div>
          <div className={cn(!compact && "flex-1 flex flex-col min-h-0")}>
            {recentTransactionsSection}
          </div>
        </div>

        {/* Right column: Bills (desktop only) over Savings & Analytics */}
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
