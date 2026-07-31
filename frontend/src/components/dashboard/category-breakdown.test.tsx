import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CategoryBreakdown, summarizeCategories } from './category-breakdown'

const getMock = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

/**
 * The processing effect lists `user` in its dependency array, so the mock has
 * to return a stable reference or the effect re-runs on every render.
 */
const { authValue } = vi.hoisted(() => ({
  authValue: {
    user: { uid: 'test-uid', getIdToken: async () => 'test-token' },
    userData: { settings: { currency: 'USD' } },
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => authValue,
}))

/**
 * ResponsiveContainer measures its parent, which is always 0x0 in jsdom, so
 * recharts would bail out of rendering entirely and log size warnings.
 */
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResponsiveContainer: ({ children }: { children: any }) =>
      React.cloneElement(children, { width: 600, height: 300 }),
  }
})

const DAY_MS = 24 * 60 * 60 * 1000

/** Inside the default "Last 30 days" window the component filters on. */
function recentDate(daysBack = 3): string {
  return new Date(Date.now() - daysBack * DAY_MS).toISOString()
}

/** One expense per category, so category totals equal the amounts given. */
function serveCategories(amountsByCategory: Record<string, number>) {
  const items = Object.entries(amountsByCategory).map(([category, amount], index) => ({
    id: `expense-${index}`,
    name: `${category} purchase`,
    amount,
    date: recentDate(),
    category,
    userId: 'test-uid',
  }))
  getMock.mockResolvedValue({
    data: items,
    pagination: { hasMore: false, nextCursor: null, count: items.length },
  })
}

function renderBreakdown() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CategoryBreakdown />
    </QueryClientProvider>
  )
}

/** "$1,625.00" -> 1625. */
function money(text: string | null | undefined): number {
  return Number((text ?? '').replace(/[^0-9.-]/g, ''))
}

/**
 * The amount rendered opposite a label. Climbs from the label to the nearest
 * ancestor whose trailing span holds a formatted amount, so it works for the
 * legend rows, the remainder rows and the Total row without hard-coding the
 * class soup of each one.
 */
function amountBesideLabel(label: string | RegExp): number {
  let node: HTMLElement | null = screen.getByText(label).parentElement
  for (let depth = 0; node && depth < 5; depth += 1) {
    const spans = node.querySelectorAll('span')
    const last = spans[spans.length - 1]
    if (last && last.textContent?.includes('$')) {
      return money(last.textContent)
    }
    node = node.parentElement
  }
  throw new Error(`No amount rendered beside "${label}"`)
}

/**
 * Every amount in the collapsed legend grid, one per drawn category plus the
 * remainder row when the top-N cut dropped anything.
 */
function legendAmounts(container: HTMLElement): number[] {
  const grid = container.querySelector('div.grid')
  if (!grid) throw new Error('Legend grid was not rendered')
  return Array.from(grid.children).map((row) => {
    const spans = row.querySelectorAll('span')
    return money(spans[spans.length - 1].textContent)
  })
}

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0)

/**
 * Eight categories worth 1625 in total; the top five are worth 1500. Every
 * assertion below is written so the two numbers cannot be confused.
 */
const EIGHT_CATEGORIES = {
  Dining: 500,
  Rent: 400,
  Transport: 300,
  Shopping: 200,
  Health: 100,
  Pets: 60,
  Books: 40,
  Gifts: 25,
}

beforeEach(() => {
  getMock.mockReset()
})

describe('summarizeCategories - total covers every category, not the drawn ones', () => {
  it('sums all categories even when only five are drawn', () => {
    const summary = summarizeCategories(EIGHT_CATEGORIES)

    expect(summary.total).toBe(1625)
    // The bug reported 1500 here: the subtotal of the five it kept.
    expect(summary.total).not.toBe(1500)
    expect(summary.items).toHaveLength(5)
    expect(summary.items.map((item) => item.name)).toEqual([
      'Dining',
      'Rent',
      'Transport',
      'Shopping',
      'Health',
    ])
  })

  it('accounts for the dropped categories so the parts add back up', () => {
    const summary = summarizeCategories(EIGHT_CATEGORIES)

    expect(summary.truncated).not.toBeNull()
    expect(summary.truncated?.count).toBe(3)
    expect(summary.truncated?.value).toBe(125)
    expect(sum(summary.items.map((item) => item.value)) + (summary.truncated?.value ?? 0)).toBe(
      summary.total
    )
  })

  it('computes each share against the real total', () => {
    const summary = summarizeCategories(EIGHT_CATEGORIES)

    // 500/1625 = 30.8% -> 31. Against the truncated 1500 it would be 33.
    expect(summary.items[0].percentage).toBe(31)
    expect(summary.items[0].percentage).not.toBe(33)

    const allShares = sum(summary.items.map((item) => item.percentage)) + (summary.truncated?.percentage ?? 0)
    expect(allShares).toBeGreaterThanOrEqual(99)
    expect(allShares).toBeLessThanOrEqual(101)
  })

  it('records no remainder when every category fits', () => {
    const summary = summarizeCategories({ A: 5, B: 4, C: 3, D: 2, E: 1 })

    expect(summary.truncated).toBeNull()
    expect(summary.items).toHaveLength(5)
    expect(sum(summary.items.map((item) => item.value))).toBe(summary.total)
    expect(summary.total).toBe(15)
  })

  it('honours a smaller display limit without losing money', () => {
    const summary = summarizeCategories(EIGHT_CATEGORIES, 2)

    expect(summary.items).toHaveLength(2)
    expect(summary.truncated?.count).toBe(6)
    expect(sum(summary.items.map((item) => item.value)) + (summary.truncated?.value ?? 0)).toBe(1625)
  })

  it('returns an empty summary for a period with no spending', () => {
    expect(summarizeCategories({})).toEqual({ items: [], total: 0, truncated: null })
  })

  it('does not divide by zero when every category is zero', () => {
    const summary = summarizeCategories({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 })

    expect(summary.total).toBe(0)
    expect(summary.items.every((item) => Number.isFinite(item.percentage))).toBe(true)
    expect(summary.items.map((item) => item.percentage)).toEqual([0, 0, 0, 0, 0])
    expect(summary.truncated?.percentage).toBe(0)
  })

  it('ranks by value and colours by rank, so the darkest swatch is the largest slice', () => {
    // Insertion order deliberately disagrees with value order; colours used to
    // be assigned before the sort, so the ramp did not match the chart.
    const summary = summarizeCategories({ Small: 1, Huge: 100, Medium: 50 })

    expect(summary.items.map((item) => item.name)).toEqual(['Huge', 'Medium', 'Small'])
    expect(summary.items[0].color).toBe('rgba(245, 245, 240, 0.9)')
    expect(summary.items[1].color).toBe('rgba(245, 245, 240, 0.7)')
    expect(summary.items[2].color).toBe('rgba(245, 245, 240, 0.5)')
  })
})

describe('CategoryBreakdown - rendered parts sum to the stated Total', () => {
  it('states the true total when there are more categories than it draws', async () => {
    serveCategories(EIGHT_CATEGORIES)
    renderBreakdown()

    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument())
    expect(amountBesideLabel('Total')).toBe(1625)
    expect(amountBesideLabel('Total')).not.toBe(1500)
  })

  it('folds the dropped categories into one row so the legend adds up', async () => {
    serveCategories(EIGHT_CATEGORIES)
    const { container } = renderBreakdown()

    await waitFor(() => expect(screen.getByText('+3 more categories')).toBeInTheDocument())

    const amounts = legendAmounts(container)
    expect(amounts).toHaveLength(6) // five categories plus the remainder
    expect(sum(amounts)).toBe(amountBesideLabel('Total'))
    expect(amountBesideLabel('+3 more categories')).toBe(125)
  })

  it('draws no remainder row when every category fits', async () => {
    serveCategories({ Dining: 500, Rent: 400, Transport: 300, Shopping: 200, Health: 100 })
    const { container } = renderBreakdown()

    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument())

    expect(screen.queryByText(/more categor/)).not.toBeInTheDocument()
    const amounts = legendAmounts(container)
    expect(amounts).toHaveLength(5)
    expect(sum(amounts)).toBe(1500)
    expect(amountBesideLabel('Total')).toBe(1500)
  })

  it('says "category" when exactly one is folded away', async () => {
    serveCategories({ Dining: 500, Rent: 400, Transport: 300, Shopping: 200, Health: 100, Pets: 60 })
    const { container } = renderBreakdown()

    await waitFor(() => expect(screen.getByText('+1 more category')).toBeInTheDocument())
    expect(sum(legendAmounts(container))).toBe(1560)
    expect(amountBesideLabel('Total')).toBe(1560)
  })

  it('states the same total in the detailed breakdown', async () => {
    serveCategories(EIGHT_CATEGORIES)
    renderBreakdown()

    await waitFor(() => expect(screen.getByText('Total')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /view detailed breakdown/i }))

    expect(screen.getByText('Category Details')).toBeInTheDocument()
    expect(amountBesideLabel('Total')).toBe(1625)
    expect(amountBesideLabel('+3 more categories')).toBe(125)
  })

  it('explains an empty period rather than showing a zero total', async () => {
    serveCategories({})
    renderBreakdown()

    await waitFor(() => expect(screen.getByText('No expense data available')).toBeInTheDocument())
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })
})
