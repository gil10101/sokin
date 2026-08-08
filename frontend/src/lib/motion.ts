/**
 * The landing page's easing vocabulary.
 *
 * Every entry animation on the page used framer's default curve or a bare
 * "easeOut", which is why the page read as unfinished: an arrival, a departure
 * and a continuous loop are different gestures, and giving all three the same
 * anonymous ease makes none of them look chosen. These four curves are the only
 * ones the landing page is allowed to use, so the timing reads as one system
 * rather than a per-element guess.
 *
 * `motion-system.module.css` mirrors these as `--ease-*` custom properties,
 * because the CSS-driven entry animations have to be correct in the very first
 * painted frame and cannot wait for JavaScript. The numbers in the two files
 * must move together.
 */

type CubicBezier = [number, number, number, number]

export const EASE: Record<"entrance" | "exit" | "drift" | "swap", CubicBezier> = {
  /**
   * Arrivals. Almost all of the distance is covered in the first third, then it
   * settles for a long time - the element looks like it is coming to rest
   * rather than sliding to a stop.
   */
  entrance: [0.16, 1, 0.3, 1],

  /**
   * Departures. Reluctant to leave, then accelerates off. An exit that
   * decelerates looks like it changed its mind.
   */
  exit: [0.4, 0, 1, 1],

  /**
   * Continuous loops, such as the scroll cue's bob. Symmetric on purpose: an
   * asymmetric curve leaves a visible seam every time the animation repeats.
   */
  drift: [0.37, 0, 0.63, 1],

  /**
   * Content replacing content in a fixed frame, such as the feature carousel.
   * Softer than `entrance` because the element is not arriving from off-screen
   * and a hard settle would draw the eye to the swap rather than the words.
   */
  swap: [0.22, 1, 0.36, 1],
}
