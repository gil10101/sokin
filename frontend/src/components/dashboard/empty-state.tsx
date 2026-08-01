"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

type EmptyStateSize = "sm" | "md" | "lg"

interface EmptyStateProps {
  /** Optional glyph above the title. */
  icon?: LucideIcon
  /** What is absent, e.g. "No expenses found". */
  title: ReactNode
  /** Why it is absent or what to do about it. */
  description?: ReactNode
  /** A single call to action, usually a Button. */
  action?: ReactNode
  /**
   * Matches the height of the content it stands in for, so a panel that has a
   * fixed height when populated keeps it when empty. Given a height, the state
   * centres itself vertically inside it; without one it sizes to its own
   * content and uses the padding for the size.
   */
  height?: number | string
  size?: EmptyStateSize
  className?: string
}

const SIZES: Record<EmptyStateSize, {
  icon: string
  title: string
  description: string
  action: string
  padding: string
}> = {
  sm: {
    icon: "h-6 w-6 mb-2",
    title: "text-xs",
    description: "text-xs mt-1 max-w-[15rem]",
    action: "mt-3",
    padding: "py-6",
  },
  md: {
    icon: "h-10 w-10 mb-3",
    title: "text-base",
    description: "text-sm mt-1.5 max-w-sm",
    action: "mt-5",
    padding: "py-12",
  },
  lg: {
    icon: "h-16 w-16 mb-6",
    title: "text-xl",
    description: "text-base mt-3 max-w-md leading-relaxed",
    action: "mt-8",
    padding: "py-16",
  },
}

/**
 * The one empty state on the dashboard.
 *
 * Every panel used to roll its own, and they disagreed on alignment: some
 * centred the block but not the text inside it, so any description long enough
 * to wrap rendered ragged-right against a centred icon above it. Others were
 * centred horizontally but pinned to the top of a panel that reserved a fixed
 * height when populated, so an empty card sat high while the card beside it sat
 * centred. Both are only visible once the copy is long enough or the viewport
 * narrow enough, which is why they survived - so the fix is one component
 * rather than a pass of alignment classes that the next panel will forget.
 *
 * Centring is not optional here and is deliberately not overridable through
 * `className`: that is the whole point of the component.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  height,
  size = "md",
  className = "",
}: EmptyStateProps) {
  const s = SIZES[size]

  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-4 ${
        height === undefined ? s.padding : ""
      } ${className}`}
      style={height === undefined ? undefined : { height }}
    >
      {Icon && <Icon className={`${s.icon} text-cream/40 shrink-0`} aria-hidden="true" />}
      <p className={`${s.title} font-medium text-cream/70`}>{title}</p>
      {description && <p className={`${s.description} text-cream/50`}>{description}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  )
}
