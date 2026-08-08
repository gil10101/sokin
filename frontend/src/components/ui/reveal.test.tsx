import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { Reveal, RevealGroup, Drift, type MotionCue } from './reveal'
import { EASE } from '@/lib/motion'

const ALL_CUES: MotionCue[] = [
  'scene',
  'headline',
  'tagline',
  'actions',
  'scrollCue',
  'eyebrow',
  'heading',
  'body',
]

/**
 * jsdom has no IntersectionObserver. Stubbing it here rather than in the global
 * setup keeps the trigger under the test's control: these tests are about when
 * an element is allowed to arrive, so the moment of intersection has to be
 * something the test decides.
 */
type Observed = {
  callback: IntersectionObserverCallback
  instance: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }
}

let observers: Observed[] = []

function installIntersectionObserver() {
  observers = []
  class IntersectionObserverStub {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
    root = null
    rootMargin = ''
    thresholds: number[] = []
    constructor(callback: IntersectionObserverCallback) {
      observers.push({ callback, instance: this })
    }
  }
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
}

/** Fires every live observer as if its target had scrolled into view. */
function scrollIntoView() {
  act(() => {
    for (const { callback, instance } of observers) {
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        instance as unknown as IntersectionObserver
      )
    }
  })
}

beforeEach(() => {
  installIntersectionObserver()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Reveal cue mapping', () => {
  it('gives every cue its own class', () => {
    // A cue added to the union but not to the class map would render with no
    // timing of its own and silently inherit the base pose - the element would
    // still animate, so nothing would look broken, it would just be off the
    // choreography.
    const classes = ALL_CUES.map((cue) => {
      const { container, unmount } = render(<Reveal cue={cue}>{cue}</Reveal>)
      const own = (container.firstElementChild as HTMLElement).className
        .split(/\s+/)
        .filter(Boolean)
      unmount()
      return own
    })

    // Every cue carries the shared base class plus one of its own.
    for (const own of classes) {
      expect(own).toHaveLength(2)
    }
    expect(new Set(classes.map((c) => c[0])).size).toBe(1)
    expect(new Set(classes.map((c) => c[1])).size).toBe(ALL_CUES.length)
  })

  it('keeps the caller’s own class names', () => {
    render(
      <Reveal cue="headline" className="text-5xl font-outfit">
        Sokin
      </Reveal>
    )
    const el = screen.getByText('Sokin')
    expect(el.className).toContain('text-5xl')
    expect(el.className).toContain('font-outfit')
  })

  it('renders the tag it was asked for, so wrapping markup cannot change layout', () => {
    render(
      <Reveal as="h1" cue="headline">
        Sokin
      </Reveal>
    )
    expect(screen.getByText('Sokin').tagName).toBe('H1')
  })
})

describe('RevealGroup triggers', () => {
  it('starts hidden so the server-rendered pose is the hidden one', () => {
    render(
      <RevealGroup on="view">
        <Reveal cue="heading">Later</Reveal>
      </RevealGroup>
    )
    expect(screen.getByText('Later').closest('[data-revealed]')).toHaveAttribute(
      'data-revealed',
      'false'
    )
  })

  it('reveals an above-the-fold group on mount without waiting to be seen', async () => {
    render(
      <RevealGroup on="load">
        <Reveal cue="headline">Sokin</Reveal>
      </RevealGroup>
    )
    await waitFor(() =>
      expect(screen.getByText('Sokin').closest('[data-revealed]')).toHaveAttribute(
        'data-revealed',
        'true'
      )
    )
  })

  it('holds a below-the-fold group back until it is actually scrolled to', async () => {
    render(
      <RevealGroup on="view">
        <Reveal cue="heading">About</Reveal>
      </RevealGroup>
    )
    const group = screen.getByText('About').closest('[data-revealed]')!

    // Several frames pass with no intersection: it must not leak into view.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(group).toHaveAttribute('data-revealed', 'false')

    scrollIntoView()
    await waitFor(() => expect(group).toHaveAttribute('data-revealed', 'true'))
  })

  it('ignores an observer callback that reports no intersection', async () => {
    render(
      <RevealGroup on="view">
        <Reveal cue="heading">About</Reveal>
      </RevealGroup>
    )
    const group = screen.getByText('About').closest('[data-revealed]')!

    act(() => {
      for (const { callback, instance } of observers) {
        callback(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          instance as unknown as IntersectionObserver
        )
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(group).toHaveAttribute('data-revealed', 'false')
  })

  it('stops observing once it has fired, so scrolling back cannot replay it', async () => {
    render(
      <RevealGroup on="view">
        <Reveal cue="heading">About</Reveal>
      </RevealGroup>
    )
    const group = screen.getByText('About').closest('[data-revealed]')!
    const observer = observers[0]!

    scrollIntoView()
    await waitFor(() => expect(group).toHaveAttribute('data-revealed', 'true'))

    // Disconnected on the way out. A live observer would keep reading the same
    // scroll position that the pinned feature carousel already depends on, and
    // would re-run the section every time the reader passed it.
    expect(observer.instance.disconnect).toHaveBeenCalled()
    expect(group).toHaveAttribute('data-revealed', 'true')
  })

  it('stays revealed after scrolling back past it', async () => {
    render(
      <RevealGroup on="view">
        <Reveal cue="heading">About</Reveal>
      </RevealGroup>
    )
    const group = screen.getByText('About').closest('[data-revealed]')!

    scrollIntoView()
    await waitFor(() => expect(group).toHaveAttribute('data-revealed', 'true'))

    // The section leaving the viewport must not undo it. A plain
    // whileInView-style binding would hide the block again here and replay the
    // whole entry the next time the reader came back to it.
    act(() => {
      for (const { callback, instance } of observers) {
        callback(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          instance as unknown as IntersectionObserver
        )
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(group).toHaveAttribute('data-revealed', 'true')
  })

  it('never re-arms after revealing', async () => {
    render(
      <RevealGroup on="view">
        <Reveal cue="heading">About</Reveal>
      </RevealGroup>
    )
    const group = screen.getByText('About').closest('[data-revealed]')!
    const observersCreatedBefore = observers.length

    scrollIntoView()
    await waitFor(() => expect(group).toHaveAttribute('data-revealed', 'true'))
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(observers.length).toBe(observersCreatedBefore)
    expect(group).toHaveAttribute('data-revealed', 'true')
  })
})

describe('Reveal trigger ownership', () => {
  it('lets the group own the timing of its children', () => {
    render(
      <RevealGroup on="view">
        <Reveal cue="eyebrow">01 / About</Reveal>
        <Reveal cue="heading">A new approach</Reveal>
      </RevealGroup>
    )

    // Children carry no trigger state of their own. If they did, each would
    // start from the moment it personally crossed the viewport edge, which
    // orders them by scroll position instead of by design.
    expect(screen.getByText('01 / About')).not.toHaveAttribute('data-revealed')
    expect(screen.getByText('A new approach')).not.toHaveAttribute('data-revealed')

    // Exactly one observer for the whole block, not one per child.
    expect(observers).toHaveLength(1)
  })

  it('creates no observer at all for a group that starts on load', () => {
    render(
      <RevealGroup on="load">
        <Reveal cue="headline">Sokin</Reveal>
      </RevealGroup>
    )
    // The hero is already on screen; asking an observer about it would only add
    // a frame of latency to the first thing the visitor sees.
    expect(observers).toHaveLength(0)
  })

  it('falls back to revealing itself when used without a group', async () => {
    render(<Reveal cue="body">Stray</Reveal>)
    const el = screen.getByText('Stray')

    expect(el).toHaveAttribute('data-revealed', 'false')
    scrollIntoView()
    await waitFor(() => expect(el).toHaveAttribute('data-revealed', 'true'))
  })

  it('shows content even where IntersectionObserver does not exist', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    render(
      <RevealGroup on="view">
        <Reveal cue="heading">About</Reveal>
      </RevealGroup>
    )

    // A missing API must cost the animation, never the content.
    await waitFor(() =>
      expect(screen.getByText('About').closest('[data-revealed]')).toHaveAttribute(
        'data-revealed',
        'true'
      )
    )
  })
})

describe('Drift', () => {
  it('puts the loop on a node of its own', () => {
    render(
      <Reveal cue="scrollCue">
        <Drift>
          <button>Down</button>
        </Drift>
      </Reveal>
    )
    const button = screen.getByRole('button', { name: 'Down' })
    const drift = button.parentElement!
    const reveal = drift.parentElement!

    // A keyframe animation and a transition cannot both own `transform` on one
    // element - the animation wins and the entry never moves.
    expect(drift).not.toBe(reveal)
    expect(drift.className).not.toBe(reveal.className)
  })
})

/**
 * The rules below are enforced against the stylesheet itself.
 *
 * Everything that varies by viewport or by motion preference lives in CSS,
 * because it has to be right in the first painted frame - so CSS is also the
 * only place those guarantees can be checked.
 */
describe('the motion stylesheet', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/components/ui/motion-system.module.css'),
    'utf8'
  )

  /** Returns the body of the block whose selector starts at `from`. */
  function blockAt(source: string, from: number): { body: string; end: number } {
    const open = source.indexOf('{', from)
    let depth = 0
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return { body: source.slice(open + 1, i), end: i }
      }
    }
    throw new Error('unbalanced braces in motion-system.module.css')
  }

  const mobileMediaStart = css.indexOf('@media (max-width: 767px)')
  const desktopRegion = css.slice(0, mobileMediaStart)
  const mobileRegion = blockAt(css, mobileMediaStart).body

  const reducedStart = css.indexOf('@media (prefers-reduced-motion: reduce)')
  const reducedRegion = reducedStart === -1 ? '' : blockAt(css, reducedStart).body

  /** Every rule outside an at-rule, in source order - order decides ties. */
  function rulesInOrder(source: string): { selector: string; body: string }[] {
    const rules: { selector: string; body: string }[] = []
    let at = 0
    while (at < source.length) {
      const open = source.indexOf('{', at)
      if (open === -1) break
      const selector = source
        .slice(at, open)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
      const { end } = blockAt(source, at)
      if (!selector.startsWith('@')) rules.push({ selector, body: blockAt(source, at).body })
      at = end + 1
    }
    return rules
  }

  function cueValue(region: string, cue: string, prop: string): number {
    const selector = `.cue${cue[0]!.toUpperCase()}${cue.slice(1)}`
    const at = region.indexOf(selector + ' {')
    expect(at, `${selector} missing`).toBeGreaterThan(-1)
    const body = blockAt(region, at).body
    const match = body.match(new RegExp(`${prop}:\\s*([\\d.]+)`))
    expect(match, `${prop} missing from ${selector}`).not.toBeNull()
    return Number(match![1])
  }

  it.each(ALL_CUES)('gives %s a shorter throw on a phone than on a desktop', (cue) => {
    // A 26px lift that reads as gentle across 1280px is a lurch inside 390px.
    const desktop = cueValue(desktopRegion, cue, '--reveal-throw')
    const mobile = cueValue(mobileRegion, cue, '--reveal-throw')
    expect(mobile).toBeLessThan(desktop)
    expect(mobile).toBeGreaterThan(0)
  })

  it.each(ALL_CUES)('lands %s sooner on a phone than on a desktop', (cue) => {
    const desktop = cueValue(desktopRegion, cue, '--reveal-duration')
    const mobile = cueValue(mobileRegion, cue, '--reveal-duration')
    expect(mobile).toBeLessThan(desktop)
  })

  it('overlaps the hero cues instead of queueing them', () => {
    // Each cue must still be in flight when the next one starts, otherwise the
    // hero reads as a list loading rather than as one movement.
    for (const region of [desktopRegion, mobileRegion]) {
      const hero = ['headline', 'tagline', 'actions']
      for (let i = 0; i < hero.length - 1; i++) {
        const start = cueValue(region, hero[i]!, '--reveal-delay')
        const end = start + cueValue(region, hero[i]!, '--reveal-duration')
        const nextStart = cueValue(region, hero[i + 1]!, '--reveal-delay')
        expect(nextStart).toBeGreaterThan(start)
        expect(nextStart).toBeLessThan(end)
      }
    }
  })

  it('animates nothing but transform and opacity on the entry path', () => {
    const at = css.indexOf('.reveal {')
    const body = blockAt(css, at).body
    const transition = body.slice(body.indexOf('transition:'))
    for (const forbidden of ['width', 'height', 'top', 'left', 'margin', 'padding']) {
      expect(transition).not.toContain(forbidden)
    }
    expect(transition).toContain('opacity')
    expect(transition).toContain('transform')
  })

  it('lets go of the compositor hint once a cue has arrived', () => {
    // There is a WebGL canvas painting behind this page. A cue that keeps
    // `will-change` after it has settled keeps a layer alive for the life of
    // the page, and the hint alone is not enough to notice that: a cue inside a
    // RevealGroup carries no `data-revealed` of its own, so a rule written only
    // as `:not([data-revealed="true"])` matches it forever.
    const rules = rulesInOrder(css)
    const hint = rules.findIndex((rule) => /will-change:\s*opacity/.test(rule.body))
    const release = rules.findIndex((rule) => /will-change:\s*auto/.test(rule.body))

    expect(hint, 'no will-change hint at all').toBeGreaterThan(-1)
    expect(release, 'nothing ever releases will-change').toBeGreaterThan(-1)

    // For a standalone cue both selectors weigh the same, so the release only
    // wins by coming second.
    expect(release).toBeGreaterThan(hint)

    // Both shapes of cue have to be released: the one a group owns, and the one
    // that owns itself.
    expect(rules[release]!.selector).toMatch(
      /\.revealRoot\[data-revealed="true"\]\s+\.reveal/
    )
    expect(rules[release]!.selector).toMatch(/(^|,)\s*\.reveal\[data-revealed="true"\]/)
  })

  it('drops every translate and every loop under reduced motion', () => {
    expect(reducedRegion, 'no prefers-reduced-motion block at all').not.toBe('')
    expect(reducedRegion).toContain('transform: none')
    expect(reducedRegion).toContain('animation: none')
  })

  it('still lets content arrive under reduced motion', () => {
    // Reduced motion means less movement, not a blank page: opacity has to
    // survive as the thing that brings content in.
    expect(reducedRegion).toContain('transition-property: opacity')
    expect(reducedRegion).not.toMatch(/opacity:\s*0\b/)
  })

  it('keeps the easing curves in step with src/lib/motion.ts', () => {
    // The curves are named in TypeScript and mirrored here for the CSS-driven
    // entries. Drift between the two files would give the same page two
    // different sets of timing.
    for (const [name, curve] of Object.entries(EASE)) {
      if (name === 'swap') continue // framer-only; no CSS counterpart.
      expect(css, `--ease-${name} missing or stale`).toContain(
        `--ease-${name}: cubic-bezier(${curve.join(', ')})`
      )
    }
  })
})

describe('EASE', () => {
  it('gives each gesture a distinct curve', () => {
    const curves = Object.values(EASE).map((c) => c.join(','))
    expect(new Set(curves).size).toBe(curves.length)
  })

  it('describes valid cubic-beziers', () => {
    for (const [name, curve] of Object.entries(EASE)) {
      expect(curve, name).toHaveLength(4)
      // The x components are the progress axis and are only defined in [0,1].
      expect(curve[0], `${name} x1`).toBeGreaterThanOrEqual(0)
      expect(curve[0], `${name} x1`).toBeLessThanOrEqual(1)
      expect(curve[2], `${name} x2`).toBeGreaterThanOrEqual(0)
      expect(curve[2], `${name} x2`).toBeLessThanOrEqual(1)
    }
  })

  it('decelerates on arrival and accelerates on departure', () => {
    // An exit that decelerates looks like it changed its mind; an entrance that
    // accelerates looks like it was dropped.
    expect(EASE.entrance[3]).toBe(1)
    expect(EASE.entrance[1]).toBeGreaterThan(EASE.entrance[0])
    expect(EASE.exit[1]).toBeLessThan(EASE.exit[0])
  })
})
