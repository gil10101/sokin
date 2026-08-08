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

/**
 * Short form for chart axes and other space-constrained labels: "€66K".
 * Intl's compact notation keeps the symbol and grouping correct per currency,
 * which hand-rolled `$${v/1000}k` strings did not.
 */
export function formatCompactCurrency(amount: number, options: CurrencyOptions = {}): string {
  const { currency = "USD" } = options
  const safeAmount = Number.isFinite(amount) ? amount : 0

  const cacheKey = `compact:${currency}`
  let formatter = formatterCache.get(cacheKey)
  if (!formatter) {
    const build = (code: string) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        notation: "compact",
        // Both bounds, not just the maximum. Given only a maximum, older ICU
        // pads compact output to it - the same 66000 renders "$66K" on one
        // runtime and "$66.0K" on another, so the axis labels a visitor saw
        // depended on their browser's ICU version. Pinning the minimum to 0
        // makes the output identical everywhere while still showing a decimal
        // when there is one ("$66.5K").
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
      })
    try {
      formatter = build(currency)
    } catch {
      formatter = build("USD")
    }
    formatterCache.set(cacheKey, formatter)
  }

  return formatter.format(safeAmount)
}

/**
 * Recharts hands tooltip formatters a `ValueType` - string, number, or an
 * array of either - not the `number` the call sites used to declare. Narrowing
 * it here keeps the chart components from each re-deriving the coercion, and
 * returns null rather than NaN so callers render a fallback instead of "$NaN".
 */
export function toChartNumber(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === null || raw === undefined || raw === "") return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
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
