import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatCompactCurrency,
  formatPercentChange,
  parseDateSafe,
  formatDate,
} from './format'

describe('formatCurrency', () => {
  it('renders the user currency rather than always dollars', () => {
    expect(formatCurrency(1234.5, { currency: 'USD' })).toBe('$1,234.50')
    expect(formatCurrency(1234.5, { currency: 'EUR' })).toBe('€1,234.50')
    expect(formatCurrency(1234.5, { currency: 'GBP' })).toBe('£1,234.50')
    expect(formatCurrency(1234.5, { currency: 'JPY' })).toContain('¥')
  })

  it('groups thousands and keeps two decimals by default', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00')
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('honours a decimals override without poisoning the shared formatter cache', () => {
    // Regression guard: the cache key must include `decimals`. Keyed on
    // currency alone, the second call here returns the 0-decimal formatter
    // built by the first and silently drops cents everywhere.
    expect(formatCurrency(1234.56, { currency: 'USD', decimals: 0 })).toBe('$1,235')
    expect(formatCurrency(1234.56, { currency: 'USD', decimals: 2 })).toBe('$1,234.56')
    expect(formatCurrency(1234.56, { currency: 'USD', decimals: 0 })).toBe('$1,235')
  })

  it('renders negative amounts with a sign rather than dropping it', () => {
    expect(formatCurrency(-500)).toBe('-$500.00')
  })

  it('substitutes zero for non-finite input instead of rendering "$NaN"', () => {
    expect(formatCurrency(Number.NaN)).toBe('$0.00')
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe('$0.00')
    expect(formatCurrency(Number.NEGATIVE_INFINITY)).toBe('$0.00')
  })

  it('falls back to USD when stored settings hold an invalid currency code', () => {
    // A bad code reaching Intl throws a RangeError, which would otherwise
    // crash every amount on the page.
    expect(() => formatCurrency(10, { currency: 'NOT_A_CODE' })).not.toThrow()
    expect(formatCurrency(10, { currency: 'NOT_A_CODE' })).toBe('$10.00')
  })
})

describe('formatCompactCurrency', () => {
  it('keeps the correct symbol per currency in compact notation', () => {
    // Chart axes previously hand-built `$${v/1000}k`, which was wrong for
    // every non-dollar currency and for values under 1000.
    expect(formatCompactCurrency(66000, { currency: 'USD' })).toBe('$66K')
    expect(formatCompactCurrency(66000, { currency: 'EUR' })).toBe('€66K')
  })

  it('does not force thousands on small values', () => {
    expect(formatCompactCurrency(500)).toBe('$500')
    expect(formatCompactCurrency(0)).toBe('$0')
  })

  it('scales past thousands', () => {
    expect(formatCompactCurrency(1_500_000)).toBe('$1.5M')
  })

  it('substitutes zero for non-finite input', () => {
    expect(formatCompactCurrency(Number.NaN)).toBe('$0')
  })
})

describe('formatPercentChange', () => {
  it('prefixes gains with an explicit plus so direction is unambiguous', () => {
    expect(formatPercentChange(4.86)).toBe('+4.9%')
    expect(formatPercentChange(0)).toBe('+0.0%')
  })

  it('keeps the minus sign on losses', () => {
    expect(formatPercentChange(-12.34)).toBe('-12.3%')
  })

  it('degrades to zero rather than printing "NaN%"', () => {
    expect(formatPercentChange(Number.NaN)).toBe('+0.0%')
    expect(formatPercentChange(Number.POSITIVE_INFINITY)).toBe('+0.0%')
  })
})

describe('parseDateSafe', () => {
  it('parses the ISO strings the API returns', () => {
    const parsed = parseDateSafe('2026-07-28T12:00:00.000Z')
    expect(parsed).toBeInstanceOf(Date)
    expect(parsed?.toISOString()).toBe('2026-07-28T12:00:00.000Z')
  })

  it('accepts Date and epoch input unchanged', () => {
    const now = new Date('2026-01-15T00:00:00.000Z')
    expect(parseDateSafe(now)?.getTime()).toBe(now.getTime())
    expect(parseDateSafe(now.getTime())?.getTime()).toBe(now.getTime())
  })

  it('unwraps a Firestore Timestamp via toDate()', () => {
    const target = new Date('2026-03-01T00:00:00.000Z')
    expect(parseDateSafe({ toDate: () => target })?.getTime()).toBe(target.getTime())
  })

  it('returns null for unparseable input instead of an Invalid Date', () => {
    // An Invalid Date propagates into date-fns and throws at render time,
    // taking the whole page down; null lets callers show a fallback.
    expect(parseDateSafe('not a date')).toBeNull()
    expect(parseDateSafe(null)).toBeNull()
    expect(parseDateSafe(undefined)).toBeNull()
    expect(parseDateSafe({})).toBeNull()
    expect(parseDateSafe(Number.NaN)).toBeNull()
  })

  it('returns null when a Timestamp-shaped object throws on toDate', () => {
    expect(parseDateSafe({ toDate: () => { throw new Error('bad') } })).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats valid input and yields an empty string for junk', () => {
    expect(formatDate('2026-07-28T12:00:00.000Z')).toBe('Jul 28, 2026')
    expect(formatDate('garbage')).toBe('')
    expect(formatDate(undefined)).toBe('')
  })
})
