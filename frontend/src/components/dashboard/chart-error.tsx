"use client"

import { AlertCircle } from "lucide-react"

interface ChartErrorProps {
  /** Matches the height of the chart it replaces, so the layout doesn't jump. */
  height?: number | string
  /** What failed to load, e.g. "spending data". */
  label?: string
  onRetry?: () => void
}

/**
 * Shown when the data behind a chart failed to load.
 *
 * Every chart on the dashboard defaulted its data to `[]`, so a failed request
 * was indistinguishable from an empty account: budget bars read 0%, the
 * heatmap rendered a uniformly empty grid, and the trend charts drew a flat
 * line at zero. On a finance dashboard those are claims about the user's money,
 * and they are more damaging than an obvious failure - a user can retry an
 * error, but they cannot know to distrust a confident zero.
 */
export function ChartError({ height = 240, label = "this chart", onRetry }: ChartErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-4"
      style={{ height }}
      role="alert"
    >
      <AlertCircle className="h-8 w-8 text-red-400/80 mb-2" />
      <p className="text-sm text-cream">Couldn&apos;t load {label}</p>
      <p className="text-xs text-cream/50 mt-1">
        Your data is safe — this view just failed to load.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-xs text-cream/70 underline underline-offset-2 hover:text-cream"
        >
          Try again
        </button>
      )}
    </div>
  )
}
