import { format as formatDateFns, parseISO, isValid } from "date-fns"

/**
 * Single source of truth for money and date rendering. Every user-facing
 * amount goes through formatCurrency so grouping, decimals, and the user's
 * currency setting are consistent across the app.
 */

export interface CurrencyOptions {
  /** ISO 4217 code; defaults to USD until the user's setting is loaded */
  currency?: string
  /** Number of fraction digits; defaults to 2, use 0 for compact stat cards */
  decimals?: number
}

const formatterCache = new Map<string, Intl.NumberFormat>()

export function formatCurrency(amount: number, options: CurrencyOptions = {}): string {
  const { currency = "USD", decimals = 2 } = options
  const safeAmount = Number.isFinite(amount) ? amount : 0

  const cacheKey = `${currency}:${decimals}`
  let formatter = formatterCache.get(cacheKey)
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    } catch {
      // Unknown currency code in stored settings - fall back to USD
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    }
    formatterCache.set(cacheKey, formatter)
  }

  return formatter.format(safeAmount)
}

export function formatPercentChange(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const sign = safe >= 0 ? "+" : ""
  return `${sign}${safe.toFixed(1)}%`
}

/** Parse ISO strings / Date / epoch defensively; null when unparseable. */
export function parseDateSafe(value: unknown): Date | null {
  if (value instanceof Date) return isValid(value) ? value : null
  if (typeof value === "number") {
    const d = new Date(value)
    return isValid(d) ? d : null
  }
  if (typeof value === "string") {
    const d = parseISO(value)
    if (isValid(d)) return d
    const fallback = new Date(value)
    return isValid(fallback) ? fallback : null
  }
  if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    try {
      const d = (value as { toDate: () => Date }).toDate()
      return isValid(d) ? d : null
    } catch {
      return null
    }
  }
  return null
}

/** "Jul 28, 2026" */
export function formatDate(value: unknown): string {
  const d = parseDateSafe(value)
  return d ? formatDateFns(d, "MMM d, yyyy") : ""
}

/** "Jul 28, 2026 3:41 PM" */
export function formatDateTime(value: unknown): string {
  const d = parseDateSafe(value)
  return d ? formatDateFns(d, "MMM d, yyyy h:mm a") : ""
}
