import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  SwapPanel,
  swapMotion,
  usePrefersReducedMotion,
  SWAP_TRAVEL_PX,
  SWAP_REDUCED_DURATION_S,
} from './swap-panel'
import { EASE } from '@/lib/motion'

/**
 * The swap is the only choreography on the landing page that framer still
 * drives, which means it is the only piece that cannot inherit the
 * `prefers-reduced-motion` block in `motion-system.module.css`. Everything
 * below exists because that inheritance is missing and has to be replaced by
 * something a test can hold onto.
 */

type Listener = () => void

/**
 * A `matchMedia` whose answer the test owns, and which can change its mind -
 * the real one does, when a reader flips the system setting with the page open.
 */
function stubMotionPreference(reduced: boolean) {
  const listeners = new Map<string, Set<Listener>>()
  const state = { matches: reduced }
  const queries: string[] = []

  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query)
    return {
      get matches() {
        // Only the reduced-motion query is answered `true`; anything else must
        // not be able to reach the swap by accident.
        return query === '(prefers-reduced-motion: reduce)' && state.matches
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (type: string, listener: Listener) => {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type)!.add(listener)
      },
      removeEventListener: (type: string, listener: Listener) => {
        listeners.get(type)?.delete(listener)
      },
      dispatchEvent: () => false,
    }
  })

  return {
    queries,
    set(next: boolean) {
      state.matches = next
      act(() => {
        for (const listener of listeners.get('change') ?? []) listener()
      })
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('swapMotion', () => {
  it('throws the card the same distance the stylesheet throws a cue', () => {
    const motion = swapMotion(false)
    expect(motion.initial.y).toBe(SWAP_TRAVEL_PX)
    expect(motion.animate.y).toBe(0)
    // Out the way it came in reversed: content leaves upward as the next card
    // rises to take its place.
    expect(motion.exit.y).toBe(-SWAP_TRAVEL_PX)
    expect(motion.transition).toMatchObject({ ease: EASE.swap })
  })

  it('passes no vertical offset at all under reduced motion', () => {
    const motion = swapMotion(true)

    // `y: 0` would not do. A zero offset still hands framer a transform to own
    // and to write to the element on every frame; the guarantee is that the
    // swap becomes a crossfade and never touches transform.
    for (const pose of [motion.initial, motion.animate, motion.exit] as const) {
      expect(pose).not.toHaveProperty('y')
      expect(Object.keys(pose)).toEqual(['opacity'])
    }
  })

  it('still fades the card in and out under reduced motion', () => {
    // Less motion is not no content. Something has to bring the next card in,
    // or scrolling the features track would land on a blank panel.
    const motion = swapMotion(true)
    expect(motion.initial.opacity).toBe(0)
    expect(motion.animate.opacity).toBe(1)
    expect(motion.exit.opacity).toBe(0)
  })

  it('matches the stylesheet’s reduced-motion timing rather than inventing its own', () => {
    // 240ms linear is what `motion-system.module.css` drops to; a swap running
    // on a different clock would read as a second, unrelated system.
    expect(swapMotion(true).transition).toEqual({
      duration: SWAP_REDUCED_DURATION_S,
      ease: 'linear',
    })
    expect(SWAP_REDUCED_DURATION_S * 1000).toBe(240)
  })
})

describe('usePrefersReducedMotion', () => {
  function Probe() {
    return <span>{String(usePrefersReducedMotion())}</span>
  }

  it('asks the same media query the stylesheet asks', () => {
    const media = stubMotionPreference(true)
    render(<Probe />)
    expect(media.queries).toContain('(prefers-reduced-motion: reduce)')
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('reports false when the reader has expressed no preference', () => {
    stubMotionPreference(false)
    render(<Probe />)
    expect(screen.getByText('false')).toBeInTheDocument()
  })

  it('follows the preference changing while the page is open', () => {
    const media = stubMotionPreference(false)
    render(<Probe />)
    expect(screen.getByText('false')).toBeInTheDocument()

    media.set(true)
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('survives an environment with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    render(<Probe />)
    // Reporting `false` is the safe answer: the animation is the thing at
    // stake, never whether the content renders.
    expect(screen.getByText('false')).toBeInTheDocument()
  })
})

/** The vertical component of an inline `transform`, in px. 0 when there is none. */
function translateY(el: HTMLElement): number {
  const transform = el.style.transform
  if (!transform || transform === 'none') return 0
  const match = transform.match(/translateY\(([-\d.]+)px\)/)
  return match ? Number(match[1]) : 0
}

/**
 * Drives a swap and reports the vertical offset of every card on screen at each
 * sampled frame, the way the browser measurement that caught this did.
 *
 * `mode="wait"` keeps the outgoing card mounted while it leaves, so mid-swap
 * there are two cards in the panel and both of them have to be checked.
 */
async function offsetsAcrossASwap(reduced: boolean): Promise<number[]> {
  stubMotionPreference(reduced)
  const { rerender, container } = render(
    <SwapPanel swapKey="01" className="stage">
      <p>Expenses and receipts</p>
    </SwapPanel>
  )

  const offsets: number[] = []
  const sample = () => {
    for (const el of container.querySelectorAll<HTMLElement>('.stage')) {
      offsets.push(translateY(el))
    }
  }

  sample()
  rerender(
    <SwapPanel swapKey="02" className="stage">
      <p>Budgets</p>
    </SwapPanel>
  )
  sample()

  // Long enough to cover the exit and the start of the entry at both the
  // 350ms and the 240ms timing.
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
    sample()
  }

  return offsets
}

describe('SwapPanel', () => {
  it('never moves the card vertically across a swap under reduced motion', async () => {
    const offsets = await offsetsAcrossASwap(true)

    expect(offsets.length).toBeGreaterThan(20)
    expect(Math.max(...offsets.map(Math.abs))).toBe(0)
  })

  it('does move the card vertically when no preference was expressed', async () => {
    // The mirror of the test above. Without it a swap that had lost its motion
    // altogether would still satisfy the reduced-motion assertion.
    const offsets = await offsetsAcrossASwap(false)

    expect(Math.max(...offsets.map(Math.abs))).toBeGreaterThan(0)
  })

  it('leaves the first card alone instead of animating it in on load', () => {
    stubMotionPreference(false)
    const { container } = render(
      <SwapPanel swapKey="01" className="stage">
        <p>Expenses and receipts</p>
      </SwapPanel>
    )

    // The first card is not arriving from anywhere - it is what the panel
    // already contains. Animating it would also mean animating during
    // hydration, before the client has read the motion preference.
    const first = container.querySelector<HTMLElement>('.stage')!
    expect(translateY(first)).toBe(0)
    expect(first.style.opacity === '' || first.style.opacity === '1').toBe(true)
  })

  it('renders the children it was given', () => {
    stubMotionPreference(false)
    render(
      <SwapPanel swapKey="01">
        <p>Budgets</p>
      </SwapPanel>
    )
    expect(screen.getByText('Budgets')).toBeInTheDocument()
  })
})
