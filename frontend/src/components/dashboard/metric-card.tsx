import React from "react"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string
  secondaryValue?: string
  change?: string
  trend?: "up" | "down" | "neutral"
  /**
   * How to color the trend. "spend" metrics (default) treat "up" as bad;
   * "growth" metrics (net worth, savings) treat "up" as good.
   */
  polarity?: "spend" | "growth"
  period?: string
  icon: React.ReactElement
  /**
   * Whether the figure is known yet.
   *
   * `value` is a pre-formatted string, so without this a caller with no data
   * has nothing to pass but a formatted zero - and "$0" is a claim about the
   * user's money, not an absence of one. A pending or failed request rendered
   * as "$0.00" reads as "you have nothing", which is worse than saying nothing.
   * Defaults to "ready" so existing callers are unaffected.
   */
  state?: "loading" | "error" | "ready"
  /** Retry handler for the error state; omitted renders the message alone. */
  onRetry?: () => void
}

export const MetricCard = React.memo(function MetricCard({ title, value, secondaryValue, change, trend, polarity = "spend", period, icon, state = "ready", onRetry }: MetricCardProps) {
  const upIsGood = polarity === "growth"
  const trendColor =
    trend === "up"
      ? upIsGood ? "text-green-400" : "text-red-400"
      : trend === "down"
        ? upIsGood ? "text-red-400" : "text-green-400"
        : "text-cream/60"

  return (
    <div className="bg-cream/5 rounded-xl border border-cream/10 p-5 hover:bg-cream/10 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-cream/60 font-outfit">{title}</h3>
        <div className="h-8 w-8 rounded-full bg-cream/5 flex items-center justify-center">

          {icon}
        </div>
      </div>
      <div className="space-y-1">
        {state === "loading" ? (
          <>
            <div className="h-8 w-28 bg-cream/10 rounded animate-pulse" aria-label={`${title} loading`} />
            <div className="h-4 w-20 bg-cream/5 rounded animate-pulse" />
          </>
        ) : state === "error" ? (
          <>
            <p className="text-2xl font-medium font-outfit text-cream/40" aria-label={`${title} unavailable`}>
              &mdash;
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400/80">Couldn&apos;t load</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={(event) => {
                    // The Net Worth card is wrapped in a <Link>. Without this the
                    // click bubbles to the anchor and the user is navigated to
                    // /dashboard/net-worth instead of the figure being refetched -
                    // the retry looks like it did nothing but change the page.
                    event.preventDefault()
                    event.stopPropagation()
                    onRetry()
                  }}
                  className="text-xs text-cream/60 underline underline-offset-2 hover:text-cream"
                >
                  Retry
                </button>
              )}
            </div>
          </>
        ) : (
          <>
        <p className="text-2xl font-medium font-outfit">{value}</p>
        {secondaryValue && <p className="text-sm text-cream/60">{secondaryValue}</p>}
        {change && (
          <div className="flex items-center">
            <span className={`text-sm flex items-center ${trendColor}`}>
              {trend === "up" ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : trend === "down" ? (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              ) : (
                <div className="w-3 h-0.5 bg-cream/60 rounded mr-1"></div>
              )}
              {change}
            </span>
            {period && <span className="text-xs text-cream/40 ml-1">{period}</span>}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
})
