import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NetWorthTrends } from './net-worth-trends'
import type { NetWorthTrend } from '@/lib/types'

const getMock = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', getIdToken: async () => 'test-token' },
    userData: { settings: { currency: 'USD' } },
  }),
}))

/**
 * ResponsiveContainer measures its parent, which is always 0x0 in jsdom, so
 * the chart would render no axes at all. Handing the chart a fixed size lets
 * the real recharts components run and emit their tick labels.
 */
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResponsiveContainer: ({ children }: { children: any }) =>
      React.cloneElement(children, { width: 800, height: 400 }),
  }
})

function renderTrends() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <NetWorthTrends />
    </QueryClientProvider>
  )
}

/**
 * Amounts legitimately appear more than once (the stat card and the prose
 * insight below the chart), so assertions scope to the card that owns the
 * label rather than matching text anywhere on the page.
 */
function statCard(label: string): HTMLElement {
  const card = screen.getByText(label).closest('div.rounded-lg')
  if (!card) throw new Error(`No stat card found for "${label}"`)
  return card as HTMLElement
}

function statValue(label: string): string {
  return statCard(label).querySelector('p')?.textContent?.trim() ?? ''
}

function statSubtext(label: string): string {
  return statCard(label).querySelector('div.mt-1')?.textContent?.trim() ?? ''
}

/** Four real snapshots: Jan 10k -> Feb 14k -> Mar 18k -> Apr 30k. */
const FOUR_MONTHS: NetWorthTrend[] = [
  { period: '2026-01', netWorth: 10000, totalAssets: 20000, totalLiabilities: 10000, monthlyChange: 0, monthlyChangePercent: 0 },
  { period: '2026-02', netWorth: 14000, totalAssets: 24000, totalLiabilities: 10000, monthlyChange: 4000, monthlyChangePercent: 40 },
  { period: '2026-03', netWorth: 18000, totalAssets: 28000, totalLiabilities: 10000, monthlyChange: 4000, monthlyChangePercent: 28.6 },
  { period: '2026-04', netWorth: 30000, totalAssets: 40000, totalLiabilities: 10000, monthlyChange: 12000, monthlyChangePercent: 66.7 },
]

beforeEach(() => {
  getMock.mockReset()
})

describe('NetWorthTrends - no invented data', () => {
  it('shows only the months that have snapshots, never padding out the timeframe', async () => {
    // The default timeframe asks the API for 12 months but only 4 exist.
    // The old component filled the other 8 with Math.random() values that
    // rendered indistinguishably from real ones.
    getMock.mockResolvedValue({ data: FOUR_MONTHS })
    renderTrends()

    await waitFor(() => {
      expect(screen.getByText('Recorded snapshots, Jan 2026 - Apr 2026')).toBeInTheDocument()
    })

    for (const month of ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026']) {
      expect(screen.getAllByText(month).length).toBeGreaterThan(0)
    }
    // Months with no snapshot must not appear at all.
    for (const absent of ['Dec 2025', 'Nov 2025', 'Oct 2025', 'May 2025']) {
      expect(screen.queryByText(absent)).not.toBeInTheDocument()
    }
  })

  it('renders identical output across renders, so history cannot re-roll', async () => {
    getMock.mockResolvedValue({ data: FOUR_MONTHS })

    const first = renderTrends()
    await waitFor(() => expect(screen.getByText(/Recorded snapshots/)).toBeInTheDocument())
    const firstText = first.container.textContent
    first.unmount()

    const second = renderTrends()
    await waitFor(() => expect(screen.getByText(/Recorded snapshots/)).toBeInTheDocument())
    expect(second.container.textContent).toBe(firstText)
  })

  it('explains the empty state instead of drawing a chart', async () => {
    getMock.mockResolvedValue({ data: [] })
    renderTrends()

    await waitFor(() => {
      expect(screen.getByText('No history recorded yet')).toBeInTheDocument()
    })
    // No fabricated summary figures alongside an empty history.
    expect(screen.queryByText('Best Month')).not.toBeInTheDocument()
    expect(screen.queryByText('Period Change')).not.toBeInTheDocument()
  })

  it('treats a single snapshot as "not enough data" rather than zero growth', async () => {
    getMock.mockResolvedValue({ data: [FOUR_MONTHS[0]] })
    renderTrends()

    await waitFor(() => {
      expect(screen.getByText('Needs 2 snapshots')).toBeInTheDocument()
    })
    expect(
      screen.getByText('One snapshot recorded so far. Trends appear once there are at least two.')
    ).toBeInTheDocument()
    // A lone "$0.00" here would read as "you gained nothing this period".
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })
})

describe('NetWorthTrends - summary statistics', () => {
  beforeEach(() => {
    getMock.mockResolvedValue({ data: FOUR_MONTHS })
  })

  it('computes period change across the whole range, not the last two points', async () => {
    // 30000 - 10000 = 20000 over Jan..Apr. The old code reported the final
    // month-over-month delta (12000) under a full-period label.
    renderTrends()
    await waitFor(() => expect(statValue('Period Change')).toBe('$20,000.00'))
    expect(statSubtext('Period Change')).toContain('+200.0%')
  })

  it('averages growth over the number of intervals between snapshots', async () => {
    // 20000 spread over 3 intervals (4 points), not 4 and not 12.
    renderTrends()
    await waitFor(() => expect(statValue('Avg Monthly Growth')).toBe('$6,666.67'))
  })

  it('reports the best month from real month-over-month changes', async () => {
    renderTrends()
    await waitFor(() => expect(statValue('Best Month')).toBe('$12,000.00'))
  })

  it('describes the period using the range the data covers', async () => {
    renderTrends()
    await waitFor(() => {
      expect(
        screen.getByText(/Your net worth has grown by/)
      ).toHaveTextContent('between Jan 2026 - Apr 2026')
    })
  })

  it('states a decline as a decline', async () => {
    getMock.mockResolvedValue({
      data: [
        { ...FOUR_MONTHS[0], netWorth: 30000 },
        { ...FOUR_MONTHS[3], netWorth: 10000 },
      ],
    })
    renderTrends()
    await waitFor(() => {
      expect(screen.getByText(/Your net worth has declined by/)).toBeInTheDocument()
    })
  })
})

describe('NetWorthTrends - degenerate numbers', () => {
  it('does not print Infinity when the earliest snapshot is zero', async () => {
    getMock.mockResolvedValue({
      data: [
        { period: '2026-01', netWorth: 0, totalAssets: 0, totalLiabilities: 0, monthlyChange: 0, monthlyChangePercent: 0 },
        { period: '2026-02', netWorth: 5000, totalAssets: 5000, totalLiabilities: 0, monthlyChange: 5000, monthlyChangePercent: 0 },
      ],
    })
    const { container } = renderTrends()

    await waitFor(() => expect(statValue('Period Change')).toBe('$5,000.00'))
    expect(container.textContent).not.toMatch(/Infinity/)
    expect(container.textContent).not.toMatch(/NaN/)
    expect(statSubtext('Period Change')).toContain('no baseline')
  })

  it('does not print NaN for asset growth when the first snapshot has no assets', async () => {
    getMock.mockResolvedValue({
      data: [
        { period: '2026-01', netWorth: -500, totalAssets: 0, totalLiabilities: 500, monthlyChange: 0, monthlyChangePercent: 0 },
        { period: '2026-02', netWorth: 2000, totalAssets: 2500, totalLiabilities: 500, monthlyChange: 2500, monthlyChangePercent: 0 },
      ],
    })
    const { container } = renderTrends()

    await waitFor(() =>
      expect(
        screen.getByText(/earliest snapshot recorded no assets/)
      ).toBeInTheDocument()
    )
    expect(container.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('handles a negative-to-positive swing without losing the sign', async () => {
    getMock.mockResolvedValue({
      data: [
        { period: '2026-01', netWorth: -2000, totalAssets: 1000, totalLiabilities: 3000, monthlyChange: 0, monthlyChangePercent: 0 },
        { period: '2026-02', netWorth: 1000, totalAssets: 4000, totalLiabilities: 3000, monthlyChange: 3000, monthlyChangePercent: 0 },
      ],
    })
    const { container } = renderTrends()

    // Change is +3000 against a -2000 baseline: +150%, not -150%.
    await waitFor(() => expect(statValue('Period Change')).toBe('$3,000.00'))
    expect(statSubtext('Period Change')).toContain('+150.0%')
    expect(container.textContent).not.toMatch(/NaN|Infinity/)
  })
})

describe('NetWorthTrends - failure handling', () => {
  it('reports a failed load instead of substituting invented data', async () => {
    getMock.mockRejectedValue(new Error('network down'))
    const { container } = renderTrends()

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load your net worth history/)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    // The old catch block swapped in a full random history here.
    expect(container.querySelector('.recharts-wrapper')).toBeNull()
    expect(screen.queryByText('Best Month')).not.toBeInTheDocument()
  })

  it('treats a malformed payload as empty rather than crashing', async () => {
    getMock.mockResolvedValue({})
    renderTrends()

    await waitFor(() => {
      expect(screen.getByText('No history recorded yet')).toBeInTheDocument()
    })
  })

  it('requests the number of months the selected timeframe implies', async () => {
    getMock.mockResolvedValue({ data: FOUR_MONTHS })
    renderTrends()

    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(getMock).toHaveBeenCalledWith(
      'net-worth/trends?months=12',
      expect.objectContaining({ token: 'test-token' })
    )
  })
})
