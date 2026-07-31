import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResponsiveLayoutContainer } from './responsive-layout-container'
import type { PortfolioState } from '@/hooks/use-portfolio-state'

const state = (over: Partial<PortfolioState> = {}): PortfolioState => ({
  isEmpty: true,
  isLoading: true,
  hasError: false,
  portfolioCount: 0,
  totalValue: 0,
  ...over,
})

const LOADING = state({ isEmpty: true, isLoading: true })
const EMPTY_RESOLVED = state({ isEmpty: true, isLoading: false })
const HAS_PORTFOLIO = state({ isEmpty: false, isLoading: false, portfolioCount: 2 })

function sections() {
  return {
    stockMarketSection: <div data-testid="stock">Stock Market</div>,
    recentTransactionsSection: <div data-testid="recent">Recent</div>,
    savingsAnalyticsSection: <div data-testid="savings">Savings</div>,
    billsSection: <div data-testid="bills">Bills</div>,
  }
}

function renderWith(portfolioState: PortfolioState) {
  return render(<ResponsiveLayoutContainer {...sections()} portfolioState={portfolioState} />)
}

describe('ResponsiveLayoutContainer - children survive the layout switch', () => {
  /**
   * The real regression guard. usePortfolioState always begins
   * {isEmpty:true,isLoading:true} and resolves to isLoading:false, so this
   * transition fires on every single mount. When the two cases were separate
   * JSX trees the stock section sat at a different nesting depth in each, and
   * React unmounted and rebuilt it rather than re-rendering.
   *
   * toBe() compares node identity - an equality check on markup would pass
   * against the broken version, since the rebuilt node looks identical.
   */
  it('keeps the same stock section DOM node when loading resolves to empty', () => {
    const { rerender } = renderWith(LOADING)
    const before = screen.getByTestId('stock')

    rerender(<ResponsiveLayoutContainer {...sections()} portfolioState={EMPTY_RESOLVED} />)

    expect(screen.getByTestId('stock')).toBe(before)
  })

  it('keeps the same stock section DOM node when loading resolves to a held portfolio', () => {
    const { rerender } = renderWith(LOADING)
    const before = screen.getByTestId('stock')

    rerender(<ResponsiveLayoutContainer {...sections()} portfolioState={HAS_PORTFOLIO} />)

    expect(screen.getByTestId('stock')).toBe(before)
  })

  it('keeps every section identical across a switch in both directions', () => {
    const { rerender } = renderWith(EMPTY_RESOLVED)
    const before = {
      stock: screen.getByTestId('stock'),
      recent: screen.getByTestId('recent'),
      savings: screen.getByTestId('savings'),
    }

    rerender(<ResponsiveLayoutContainer {...sections()} portfolioState={HAS_PORTFOLIO} />)
    expect(screen.getByTestId('stock')).toBe(before.stock)
    expect(screen.getByTestId('recent')).toBe(before.recent)
    expect(screen.getByTestId('savings')).toBe(before.savings)

    rerender(<ResponsiveLayoutContainer {...sections()} portfolioState={EMPTY_RESOLVED} />)
    expect(screen.getByTestId('stock')).toBe(before.stock)
    expect(screen.getByTestId('recent')).toBe(before.recent)
    expect(screen.getByTestId('savings')).toBe(before.savings)
  })

  it('preserves child component state across the switch', () => {
    // A remount would reset this to its initial value - which is exactly what
    // reset the Stock Market widget's pagination back to page 1.
    function Stateful() {
      const [n] = React.useState(() => Math.random())
      return <span data-testid="stateful">{n}</span>
    }
    const props = { ...sections(), stockMarketSection: <Stateful /> }

    const { rerender } = render(
      <ResponsiveLayoutContainer {...props} portfolioState={LOADING} />
    )
    const first = screen.getByTestId('stateful').textContent

    rerender(<ResponsiveLayoutContainer {...props} portfolioState={EMPTY_RESOLVED} />)

    expect(screen.getByTestId('stateful').textContent).toBe(first)
  })
})

describe('ResponsiveLayoutContainer - layout still differs by portfolio state', () => {
  it('stretches the columns only when a portfolio is held', () => {
    const { container, rerender } = renderWith(HAS_PORTFOLIO)
    expect(container.querySelector('.lg\\:items-stretch')).not.toBeNull()

    rerender(<ResponsiveLayoutContainer {...sections()} portfolioState={EMPTY_RESOLVED} />)
    expect(container.querySelector('.lg\\:items-stretch')).toBeNull()
  })

  it('gives the stock section its flex weighting only in the standard layout', () => {
    const { rerender } = renderWith(HAS_PORTFOLIO)
    expect(screen.getByTestId('stock').parentElement?.className).toContain('flex-[2]')

    rerender(<ResponsiveLayoutContainer {...sections()} portfolioState={EMPTY_RESOLVED} />)
    expect(screen.getByTestId('stock').parentElement?.className).not.toContain('flex-[2]')
  })

  it('treats the loading state as the standard layout, not the compact one', () => {
    // isEmpty is true while loading, so keying off it alone would flash compact.
    renderWith(LOADING)
    expect(screen.getByTestId('stock').parentElement?.className).toContain('flex-[2]')
  })

  it('renders bills once for desktop and once for mobile', () => {
    renderWith(EMPTY_RESOLVED)
    expect(screen.getAllByTestId('bills')).toHaveLength(2)
  })

  it('omits both bills slots when no bills section is given', () => {
    render(
      <ResponsiveLayoutContainer
        {...sections()}
        billsSection={undefined}
        portfolioState={EMPTY_RESOLVED}
      />
    )
    expect(screen.queryByTestId('bills')).not.toBeInTheDocument()
  })
})
