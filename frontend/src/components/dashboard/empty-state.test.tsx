import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Target } from 'lucide-react'
import { EmptyState } from './empty-state'

/**
 * The bug this component exists to end: every panel rolled its own empty state
 * and they disagreed on alignment. The assertions below are about the centring
 * contract, not about any one panel's copy, because the contract is the reason
 * the component exists.
 */
describe('EmptyState', () => {
  const root = (c: HTMLElement) => c.firstElementChild as HTMLElement

  describe('centring contract', () => {
    it('centres its own text, not just the block containing it', () => {
      // The original defect. `items-center` centres each child box but leaves
      // the text inside it start-aligned, so any description long enough to
      // wrap rendered ragged against a centred icon. Only `text-center` fixes
      // the wrapped lines, so it has to be on the root.
      const { container } = render(<EmptyState title="No expenses found" />)
      expect(root(container).className).toContain('text-center')
    })

    it('centres the block on both axes', () => {
      const { container } = render(<EmptyState title="No expenses found" />)
      const cls = root(container).className
      expect(cls).toContain('flex')
      expect(cls).toContain('flex-col')
      expect(cls).toContain('items-center')
      expect(cls).toContain('justify-center')
    })

    it('keeps centring when a caller passes its own className', () => {
      // Callers pass layout classes (h-full, flex-1, border-t). None of them
      // may cost the centring, or the inconsistency comes straight back.
      const { container } = render(
        <EmptyState className="h-full border-t border-cream/10" title="No data available" />
      )
      const cls = root(container).className
      expect(cls).toContain('text-center')
      expect(cls).toContain('items-center')
      expect(cls).toContain('justify-center')
      expect(cls).toContain('h-full')
      expect(cls).toContain('border-t')
    })

    it('centres identically at every size', () => {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const { container, unmount } = render(<EmptyState size={size} title="Nothing here" />)
        const cls = root(container).className
        expect(cls, `size=${size}`).toContain('text-center')
        expect(cls, `size=${size}`).toContain('items-center')
        expect(cls, `size=${size}`).toContain('justify-center')
        unmount()
      }
    })

    it('centres identically whether or not a height is reserved', () => {
      const { container: fixed } = render(<EmptyState height={300} title="No budget data" />)
      const { container: intrinsic } = render(<EmptyState title="No budget data" />)

      for (const c of [fixed, intrinsic]) {
        expect(root(c).className).toContain('text-center')
        expect(root(c).className).toContain('justify-center')
      }
    })

    it('centres identically with an icon, a description and an action present', () => {
      const { container } = render(
        <EmptyState
          icon={Target}
          title="No savings goals yet"
          description="Create your first savings goal to start tracking your financial progress."
          action={<button type="button">Create Your First Goal</button>}
        />
      )
      const cls = root(container).className
      expect(cls).toContain('text-center')
      expect(cls).toContain('items-center')
    })
  })

  describe('height reservation', () => {
    it('fills the height of the content it replaces so the panel does not collapse', () => {
      const { container } = render(<EmptyState height={300} title="No budget data available" />)
      expect(root(container).style.height).toBe('300px')
    })

    it('accepts a CSS length as well as a number', () => {
      const { container } = render(<EmptyState height="24rem" title="No history recorded yet" />)
      expect(root(container).style.height).toBe('24rem')
    })

    it('drops its own vertical padding when a height is reserved', () => {
      // Padding on top of a fixed height would push the content off centre,
      // which is the top-anchored variant of the same bug.
      const { container } = render(<EmptyState height={300} title="No data" />)
      expect(root(container).className).not.toMatch(/\bpy-\d/)
    })

    it('carries its own vertical padding when no height is given', () => {
      // Without it the state renders flush against the rows above and below.
      const { container } = render(<EmptyState title="No data" />)
      expect(root(container).className).toMatch(/\bpy-\d/)
    })

    it('sets no inline height when none is asked for', () => {
      const { container } = render(<EmptyState title="No data" />)
      expect(root(container).style.height).toBe('')
    })
  })

  describe('content', () => {
    it('renders the title', () => {
      render(<EmptyState title="No expenses found" />)
      expect(screen.getByText('No expenses found')).toBeInTheDocument()
    })

    it('renders a description when there is one', () => {
      render(<EmptyState title="No expenses found" description="Try adjusting your filters" />)
      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
    })

    it('renders no second paragraph when there is no description', () => {
      const { container } = render(<EmptyState title="No notifications found" />)
      expect(container.querySelectorAll('p')).toHaveLength(1)
    })

    it('renders an action when there is one, and calls through to it', () => {
      render(
        <EmptyState title="No subscriptions found" action={<button type="button">Add one</button>} />
      )
      expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument()
    })

    it('renders no action slot when the caller passes undefined', () => {
      // Call sites pass `cond ? <Button/> : undefined`; the falsy branch must
      // not leave an empty spacer div behind, or the state sits off centre.
      const { container } = render(<EmptyState title="No bills yet" action={undefined} />)
      expect(container.querySelectorAll('button')).toHaveLength(0)
      expect(root(container).children).toHaveLength(1)
    })

    it('hides the icon from assistive tech, since the title already says it', () => {
      const { container } = render(<EmptyState icon={Target} title="No savings goals yet" />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    })

    it('renders no icon when none is given', () => {
      const { container } = render(<EmptyState title="No expenses found" />)
      expect(container.querySelector('svg')).toBeNull()
    })

    it('states no figure of its own', () => {
      // Same rule as ChartError: an empty panel on a finance dashboard must not
      // put a number on screen, because a rendered zero reads as a claim about
      // the user's money rather than an absence of data.
      const { container } = render(
        <EmptyState icon={Target} title="No budget data available" description="Create budgets to track your spending progress" />
      )
      expect(container.textContent).not.toMatch(/\$/)
      expect(container.textContent).not.toMatch(/\b0\b/)
      expect(container.textContent).not.toMatch(/%/)
    })
  })
})
