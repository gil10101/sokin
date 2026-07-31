import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Retry policy of the shared API client.
 *
 * The rule that matters here is that a retry must never be able to duplicate a
 * write. `enhancedFetch` previously threw on any non-2xx response from inside
 * its own try block, so the catch treated an HTTP 500 exactly like a dropped
 * connection and replayed it - for POST as readily as for GET. On
 * `goals/:id/contribute`, which increments the balance inside a Firestore
 * transaction, a 500 arriving after the commit meant the retry added the money
 * a second time.
 */

vi.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'u1', getIdToken: async () => 'test-token' } },
  default: {},
}))

const ENV = process.env.NEXT_PUBLIC_API_URL

let fetchMock: ReturnType<typeof vi.fn>

async function loadApi() {
  vi.resetModules()
  return import('./api')
}

function jsonResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:5001/api'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  process.env.NEXT_PUBLIC_API_URL = ENV
})

/** Drives a promise that sleeps on timers to completion. */
async function settle<T>(promise: Promise<T>): Promise<{ rejected: boolean }> {
  const tracked = promise.then(
    () => ({ rejected: false }),
    () => ({ rejected: true })
  )
  await vi.runAllTimersAsync()
  return tracked
}

describe('non-idempotent writes are never replayed', () => {
  it('does not retry a POST that failed with a 500', async () => {
    // The dangerous case: the contribution may already have been committed.
    const { goalsAPI } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    await expect(
      goalsAPI.addContribution('g1', { amount: 50, method: 'manual', source: 'test' })
    ).rejects.toThrow(/HTTP 500/)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a POST whose connection dropped', async () => {
    // A transport failure does not prove the server never processed it.
    const { goalsAPI } = await loadApi()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      goalsAPI.addContribution('g1', { amount: 50, method: 'manual', source: 'test' })
    ).rejects.toThrow(/Failed to fetch/)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a PATCH that failed with a 500', async () => {
    const { API } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'boom' }))

    await expect(API.notifications.markAsRead('n1')).rejects.toThrow(/HTTP 500/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('idempotent requests still recover from transient failures', () => {
  it('retries a GET that failed with a 500 and succeeds', async () => {
    vi.useFakeTimers()
    const { goalsAPI } = await loadApi()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: 'transient' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }))

    const result = await settle(goalsAPI.getGoals())

    expect(result.rejected).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a GET whose connection dropped', async () => {
    vi.useFakeTimers()
    const { goalsAPI } = await loadApi()
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }))

    const result = await settle(goalsAPI.getGoals())

    expect(result.rejected).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a PUT, which is safe to repeat', async () => {
    vi.useFakeTimers()
    const { goalsAPI } = await loadApi()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: 'transient' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 'g1' } }))

    const result = await settle(goalsAPI.updateGoal('g1', { name: 'x' }))

    expect(result.rejected).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after exhausting its attempts rather than looping', async () => {
    vi.useFakeTimers()
    const { goalsAPI } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse(500, { error: 'down' }))

    const result = await settle(goalsAPI.getGoals())

    expect(result.rejected).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(4) // initial + 3 retries
  })
})

describe('client errors are surfaced immediately', () => {
  it('does not retry a 400, which would fail identically every time', async () => {
    const { goalsAPI } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'targetAmount is required' }))

    await expect(goalsAPI.getGoals()).rejects.toThrow(/targetAmount is required/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 403', async () => {
    const { goalsAPI } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse(403, { error: 'Forbidden' }))

    await expect(goalsAPI.getGoals()).rejects.toThrow(/HTTP 403/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('exposes the status code on the error', async () => {
    const { goalsAPI, HttpResponseError } = await loadApi()
    fetchMock.mockResolvedValue(jsonResponse(404, { error: 'Not found' }))

    await goalsAPI.getGoals().catch((error: unknown) => {
      expect(error).toBeInstanceOf(HttpResponseError)
      expect((error as InstanceType<typeof HttpResponseError>).status).toBe(404)
    })
    expect.assertions(2)
  })
})

describe('rate limiting', () => {
  it('replays a rate-limited POST, since a 429 means nothing was written', async () => {
    // The limiter rejects before the route handler runs, so this is the one
    // retry that is safe regardless of method.
    vi.useFakeTimers()
    const { goalsAPI } = await loadApi()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { error: 'Too many', retryAfter: 1 }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 'g1' } }))

    const result = await settle(
      goalsAPI.addContribution('g1', { amount: 50, method: 'manual', source: 'test' })
    )

    expect(result.rejected).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
