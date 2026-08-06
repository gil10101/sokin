import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * These routes read BACKEND_URL at module scope and threw when it was missing.
 * Next evaluates every route module while collecting page data during
 * `next build`, so a variable that only exists at runtime failed the build:
 * every Frontend CI run on main died here, at /api/expenses, before reaching
 * anything else, and the production deploy job never ran because it is gated
 * on that build.
 *
 * The first test is the one that matters - importing the module with the
 * variable unset must not throw. The rest pin the behaviour that replaced it,
 * so nobody "simplifies" the guard back to module scope.
 */

function requestWith(headers: Record<string, string>, body?: unknown) {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as never
}

describe('api/expenses with BACKEND_URL unset', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('BACKEND_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('imports without throwing, so `next build` can collect page data', async () => {
    await expect(import('./route')).resolves.toBeDefined()
  })

  it('answers 500 at request time instead of taking the build down', async () => {
    const { GET } = await import('./route')

    const res = await GET(requestWith({ authorization: 'Bearer t' }))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Backend is not configured' })
  })

  it('does not attempt a fetch to an undefined origin', async () => {
    // The old failure mode if the throw were simply deleted: a request to
    // "undefined/api/expenses", which fails somewhere far less obvious.
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { POST } = await import('./route')

    await POST(requestWith({ authorization: 'Bearer t' }, { amount: 1 }))

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('api/expenses with BACKEND_URL configured', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('BACKEND_URL', 'https://api.example.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('proxies GET to the configured backend, carrying the caller auth', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchSpy)
    const { GET } = await import('./route')

    const res = await GET(requestWith({ authorization: 'Bearer token-123' }))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.example.test/api/expenses')
    expect(init.headers.Authorization).toBe('Bearer token-123')
    expect(res.status).toBe(200)
  })

  it('rejects an unauthenticated request before calling the backend', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { GET } = await import('./route')

    const res = await GET(requestWith({}))

    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
