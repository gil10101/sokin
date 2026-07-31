import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChartError } from './chart-error'

describe('ChartError', () => {
  it('announces itself to assistive tech rather than rendering silently', () => {
    render(<ChartError />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders no figure at all', () => {
    // The defect it replaces was a chart of confident zeros. A failed load must
    // not put any number on screen, because on a finance dashboard a rendered
    // zero is a claim about the user's money rather than an absence of one.
    const { container } = render(<ChartError label="spending data" />)

    expect(container.textContent).not.toMatch(/\$/)
    expect(container.textContent).not.toMatch(/\b0\b/)
    expect(container.textContent).not.toMatch(/0%/)
  })

  it('names what failed so the user knows which panel is stale', () => {
    render(<ChartError label="budget progress" />)
    expect(screen.getByText(/Couldn't load budget progress/)).toBeInTheDocument()
  })

  it('reassures that the data itself is intact', () => {
    render(<ChartError />)
    expect(screen.getByText(/Your data is safe/)).toBeInTheDocument()
  })

  it('offers a retry and calls it', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ChartError onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits the retry control when there is nothing to retry', () => {
    render(<ChartError />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('reserves the height of the chart it replaces so the layout does not jump', () => {
    const { container } = render(<ChartError height={320} />)
    expect((container.firstChild as HTMLElement).style.height).toBe('320px')
  })
})
