import { NextResponse } from 'next/server'

/**
 * The origin of the Express backend these routes proxy to.
 *
 * This used to be read at module scope, with a `throw` if it was missing. Next
 * evaluates every route module while collecting page data during `next build`,
 * so a variable that only exists at runtime took the entire build down: CI has
 * never had BACKEND_URL set, and every run on main failed here before it could
 * reach anything else.
 *
 * Reading it per request keeps the build independent of runtime configuration
 * and puts the failure where someone can act on it - a 500 from the two routes
 * that actually need the backend, rather than a build error on every route that
 * doesn't.
 */
export function getBackendUrl(): string | null {
  return process.env.BACKEND_URL || null
}

/** The response to return when the backend origin is not configured. */
export function backendNotConfigured(): NextResponse {
  return NextResponse.json(
    { error: 'Backend is not configured' },
    { status: 500 }
  )
}
