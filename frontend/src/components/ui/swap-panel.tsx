"use client"

import { useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { AnimatePresence, motion, type MotionProps } from "framer-motion"
import { EASE } from "@/lib/motion"

/**
 * Content replacing content inside a frame that never changes size.
 *
 * This is the one piece of the landing page's choreography that cannot live in
 * `motion-system.module.css`: the outgoing card has to stay mounted long enough
 * to leave, and CSS has no way to hold a node that React has already removed.
 * Everything else about it is deliberately kept in step with that stylesheet -
 * the same easing vocabulary, the same throw distance, and the same answer to
 * `prefers-reduced-motion`.
 */

/**
 * The exact query the stylesheet uses.
 *
 * framer's own `useReducedMotion()` asks for `(prefers-reduced-motion)`, which
 * is a different query, caches the answer in module-level state on first use,
 * and by its own admission never re-renders when the preference changes. A page
 * whose CSS and JavaScript disagree about what the reader asked for is worse
 * than one that only has CSS.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeToMotionPreference(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function readMotionPreference() {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * The server cannot know the answer, so it reports the moving pose and React
 * corrects it after hydration. That is safe here only because nothing swaps
 * until the reader has scrolled - see `initial={false}` below, which keeps the
 * first card out of the animation entirely.
 */
function motionPreferenceOnServer() {
  return false
}

/** True when the reader has asked for reduced motion, live. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    readMotionPreference,
    motionPreferenceOnServer
  )
}

/** Matches `--reveal-throw` on the desktop cues, so a swap reads as the same page. */
export const SWAP_TRAVEL_PX = 24
export const SWAP_DURATION_S = 0.35
/** Mirrors the 240ms linear fallback the stylesheet uses under reduced motion. */
export const SWAP_REDUCED_DURATION_S = 0.24

type SwapPose = { opacity: number; y?: number }

interface SwapMotion {
  initial: SwapPose
  animate: SwapPose
  exit: SwapPose
  transition: NonNullable<MotionProps["transition"]>
}

/**
 * Split out from the component so the reduced-motion contract is a value that
 * can be asserted on rather than something only observable mid-animation.
 *
 * Under reduced motion `y` is absent, not zero: a `y: 0` still hands the
 * element a transform to own, and the point is that the swap becomes a
 * crossfade and touches nothing but opacity.
 */
export function swapMotion(prefersReducedMotion: boolean): SwapMotion {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: SWAP_REDUCED_DURATION_S, ease: "linear" },
    }
  }

  return {
    initial: { opacity: 0, y: SWAP_TRAVEL_PX },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -SWAP_TRAVEL_PX },
    transition: { duration: SWAP_DURATION_S, ease: EASE.swap },
  }
}

interface SwapPanelProps {
  /** Changing this is what swaps the contents. */
  swapKey: string
  children: ReactNode
  className?: string
}

export function SwapPanel({ swapKey, children, className }: SwapPanelProps) {
  const motionProps = swapMotion(usePrefersReducedMotion())

  return (
    /*
      `initial={false}` because the first card is not arriving from anywhere -
      it is simply what the panel already contains. Animating it would also mean
      animating during hydration, before the reduced-motion preference has been
      read on the client.
    */
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={swapKey} {...motionProps} className={className}>
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
