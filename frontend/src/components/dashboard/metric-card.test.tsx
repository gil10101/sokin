import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MetricCard } from './metric-card'

const icon = <svg data-testid="icon" />

function renderCard(props: Partial<React.ComponentProps<typeof MetricCard>> = {}) {
  return render(
    <MetricCard
      title="Total Expenses"
      value="$0.00"
      change="+0.0%"
      trend="neutral"
      period="vs last month"
      icon={icon}
      {...props}
    />
  )
}

describe('MetricCard - an unknown figure is never rendered as zero', () => {
  it('shows no amount at all while loading', () => {
    // The caller has nothing but a formatted zero to pass, so the card itself
    // has to refuse to render it. "$0.00" during a pending request reads as
    // "you spent nothing", which is a claim, not an absence of one.
    const { container } = renderCard({ state: 'loading' })

    expect(container.textContent).not.toContain('$0.00')
    expect(container.textContent).not.toContain('+0.0%')
    expect(screen.getByLabelText('Total Expenses loading')).toBeInTheDocument()
  })

  it('shows no amount and says so when the request failed', () => {
    const { container } = renderCard({ state: 'error' })

    expect(container.textContent).not.toContain('$0.00')
    expect(container.textContent).not.toContain('+0.0%')
    expect(screen.getByText(/Couldn't load/)).toBeInTheDocument()
  })

  it('keeps the title visible in every state so the card stays identifiable', () => {
    for (const state of ['loading', 'error', 'ready'] as const) {
      const { unmount } = renderCard({ state })
      expect(screen.getByText('Total Expenses')).toBeInTheDocument()
      unmount()
    }
  })

  it('offers a retry on error and calls it', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderCard({ state: 'error', onRetry })

    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits the retry control when no handler is supplied', () => {
    renderCard({ state: 'error' })
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })
})

describe('MetricCard - ready state', () => {
  it('renders the value, change and period', () => {
    renderCard({ state: 'ready', value: '$1,234.00', change: '+12.5%', trend: 'up' })

    expect(screen.getByText('$1,234.00')).toBeInTheDocument()
    expect(screen.getByText('+12.5%')).toBeInTheDocument()
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('defaults to ready so existing callers are unaffected', () => {
    renderCard({ value: '$99.00' })
    expect(screen.getByText('$99.00')).toBeInTheDocument()
  })

  it('renders a genuine zero when zero is the real figure', () => {
    // The point is not that "$0.00" is forbidden - it is that it must mean
    // the amount is actually zero, not that it is unknown.
    renderCard({ state: 'ready', value: '$0.00' })
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('colours a rise as bad for spending and good for growth', () => {
    const { unmount } = renderCard({ state: 'ready', trend: 'up', change: '+5%', polarity: 'spend' })
    expect(screen.getByText('+5%').className).toContain('text-red-400')
    unmount()

    renderCard({ state: 'ready', trend: 'up', change: '+5%', polarity: 'growth' })
    expect(screen.getByText('+5%').className).toContain('text-green-400')
  })
})
