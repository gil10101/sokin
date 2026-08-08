"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode, Ref } from "react"
import styles from "./motion-system.module.css"

/**
 * A named beat in the landing page's choreography.
 *
 * Callers pick the role an element plays, not a number of milliseconds. The
 * timing behind each beat lives in `motion-system.module.css`, where it can
 * differ per breakpoint and be switched off wholesale for readers who asked for
 * reduced motion - neither of which a delay passed in from a call site could
 * do.
 */
export type MotionCue =
  | "scene"
  | "headline"
  | "tagline"
  | "actions"
  | "scrollCue"
  | "eyebrow"
  | "heading"
  | "body"

const CUE_CLASS: Record<MotionCue, string> = {
  scene: styles.cueScene,
  headline: styles.cueHeadline,
  tagline: styles.cueTagline,
  actions: styles.cueActions,
  scrollCue: styles.cueScrollCue,
  eyebrow: styles.cueEyebrow,
  heading: styles.cueHeading,
  body: styles.cueBody,
}

/** When a group is allowed to start: on mount, or the first time it is seen. */
type Trigger = "load" | "view"

/**
 * Tells a `Reveal` that something above it already owns the trigger, so it
 * should not fetch its own. Without this a block's children would each start
 * from the moment they personally crossed the viewport edge, which staggers
 * them by scroll position instead of by design.
 */
const InsideRevealGroup = createContext(false)

/** Every element in a subtree animates on transform and opacity only. */
type RevealTag = "div" | "section" | "p" | "h1" | "h2" | "h3" | "span" | "nav"

function useRevealTrigger(trigger: Trigger | null) {
  const ref = useRef<HTMLElement | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (trigger === null || revealed) return undefined

    const node = ref.current
    if (!node) return undefined

    if (trigger === "load") {
      /**
       * The hidden pose has to reach the screen before the attribute flips.
       * Setting both in the same frame gives the transition no start value to
       * work from and the element simply appears - which is the failure this
       * whole file exists to fix.
       */
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setRevealed(true))
      })
      return () => {
        cancelAnimationFrame(first)
        if (second) cancelAnimationFrame(second)
      }
    }

    if (typeof IntersectionObserver === "undefined") {
      // Content arriving matters more than it arriving prettily. Never leave a
      // block stranded at opacity 0 because an API was missing.
      setRevealed(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        /**
         * Once, and then the observer is gone. Re-arming would replay the
         * section every time the reader scrolled back past it, and would leave
         * another consumer reading the same scroll position that the pinned
         * feature carousel and the 3D scene's ScrollTrigger already depend on.
         */
        observer.disconnect()
        setRevealed(true)
      },
      { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [trigger, revealed])

  return { ref, revealed }
}

interface RevealGroupProps {
  children: ReactNode
  /** `load` for anything already on screen; `view` for everything below it. */
  on: Trigger
  as?: RevealTag
  className?: string
  id?: string
}

/**
 * Owns the moment a block of choreography starts.
 *
 * The group itself is invisible to layout and to the animation - it only
 * carries the attribute that the cues underneath it key off, so wrapping
 * existing markup in one cannot move anything.
 */
export function RevealGroup({ children, on, as = "div", className, id }: RevealGroupProps) {
  const { ref, revealed } = useRevealTrigger(on)

  // Every tag in `RevealTag` is an HTMLElement; the cast only satisfies the
  // per-tag ref types that JSX would otherwise demand one variant at a time.
  const Tag = as as "div"

  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      id={id}
      className={[styles.revealRoot, className].filter(Boolean).join(" ")}
      data-revealed={revealed}
    >
      <InsideRevealGroup.Provider value={true}>{children}</InsideRevealGroup.Provider>
    </Tag>
  )
}

interface RevealProps {
  children: ReactNode
  cue: MotionCue
  as?: RevealTag
  className?: string
}

/**
 * One element in the choreography.
 *
 * Normally used inside a `RevealGroup`. On its own it triggers itself the first
 * time it is scrolled into view, so a stray call site degrades to something
 * sensible rather than to invisible content.
 */
export function Reveal({ children, cue, as = "div", className }: RevealProps) {
  const insideGroup = useContext(InsideRevealGroup)
  const { ref, revealed } = useRevealTrigger(insideGroup ? null : "view")

  const Tag = as as "div"

  return (
    <Tag
      ref={ref as Ref<HTMLDivElement>}
      className={[styles.reveal, CUE_CLASS[cue], className].filter(Boolean).join(" ")}
      {...(insideGroup ? {} : { "data-revealed": revealed })}
    >
      {children}
    </Tag>
  )
}

/**
 * Wraps a continuously looping element.
 *
 * Has to be a separate node from the `Reveal` around it: a keyframe animation
 * and a transition cannot both drive `transform` on one element, and the
 * animation would win and cancel the entry.
 */
export function Drift({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.drift, className].filter(Boolean).join(" ")}>{children}</div>
}

/** Class names for the mobile menu's height animation, which is not a cue. */
export const menuStyles = {
  shell: styles.menuShell,
  clip: styles.menuClip,
  content: styles.menuContent,
}

/**
 * Without JavaScript nothing ever flips `data-revealed`, and the hidden pose in
 * the server-rendered HTML would be the final word. The page is worth more as
 * unanimated text than as a blank screen.
 */
export function RevealNoScriptFallback() {
  return (
    <noscript>
      <style>{`.${styles.reveal}{opacity:1;transform:none}`}</style>
    </noscript>
  )
}
