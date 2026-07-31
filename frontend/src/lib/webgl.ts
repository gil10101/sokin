/**
 * Whether this browser can actually give us a WebGL context.
 *
 * three.js throws "Error creating WebGL context" from the WebGLRenderer
 * constructor when it cannot get one, which takes down the whole scene rather
 * than degrading. That happens on machines without GPU acceleration, in
 * headless browsers, when hardware acceleration is disabled, and when a driver
 * is blocklisted - none of which the visitor can do anything about, and none
 * of which should cost them the page.
 *
 * The probe canvas is discarded immediately; the result is cached because
 * creating contexts is not free and the answer cannot change within a session.
 */
let cached: boolean | null = null

export function isWebGLAvailable(): boolean {
  if (cached !== null) return cached
  if (typeof window === "undefined") return false

  try {
    const canvas = document.createElement("canvas")
    const context =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")

    cached = Boolean(context)

    // Release the probe context rather than waiting for GC; browsers cap the
    // number of live WebGL contexts and a leaked one can starve the real scene.
    if (context && "getExtension" in context) {
      ;(context as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext()
    }
  } catch {
    cached = false
  }

  return cached
}

/** Test seam - lets a suite exercise both branches. */
export function resetWebGLAvailabilityCache(): void {
  cached = null
}
