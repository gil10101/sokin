import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * These tests are about what survives the trip to the error tracker.
 *
 * Every issue Sentry had collected carried a title and nothing else: a single
 * minified frame pointing at this file, and none of the context the call sites
 * assemble. Two independent drops caused it - the logger reduced the caller's
 * Error to `{name, message}` and threw the object away, and `captureError`
 * accepted a context argument it never passed on. Both are asserted here,
 * because either one alone is enough to make a report unactionable.
 */

const captureError = vi.fn()
const logMessage = vi.fn()

vi.mock('./sentry', () => ({
  captureError: (...args: unknown[]) => captureError(...args),
  logMessage: (...args: unknown[]) => logMessage(...args),
}))

/** Loads a logger bound to the given NODE_ENV, since it reads it once at construction. */
async function loadLogger(env: string) {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', env)
  const mod = await import('./logger')
  return mod.logger
}

/** The dynamic import inside the logger resolves on a later microtask. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('logger', () => {
  beforeEach(() => {
    captureError.mockClear()
    logMessage.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('in production, reporting an error', () => {
    it('attaches the original error as the cause, so the real stack survives', async () => {
      const logger = await loadLogger('production')
      const original = new Error('Request failed with status 503')

      logger.error('Error fetching budget categories', original)
      await flush()

      expect(captureError).toHaveBeenCalledTimes(1)
      const [reported] = captureError.mock.calls[0]
      expect(reported).toBeInstanceOf(Error)
      expect((reported as Error).cause).toBe(original)
    })

    it('keeps the log message as the reported title, so grouping does not move', async () => {
      // Existing issues are grouped by this message. Reporting the underlying
      // error as the top-level exception instead would split every issue in
      // the stream into a new one.
      const logger = await loadLogger('production')

      logger.error('Error checking portfolio state', new Error('NetworkError'))
      await flush()

      const [reported] = captureError.mock.calls[0]
      expect((reported as Error).message).toBe('Error checking portfolio state')
    })

    it('forwards the caller-supplied context', async () => {
      const logger = await loadLogger('production')

      logger.error('Error fetching budget categories', {
        userId: 'LW3zNxhFnJde',
        error: 'Request failed',
      })
      await flush()

      expect(captureError).toHaveBeenCalledTimes(1)
      const [, context] = captureError.mock.calls[0]
      expect(context).toEqual({ userId: 'LW3zNxhFnJde', error: 'Request failed' })
    })

    it('forwards the error name and message as context when handed an Error', async () => {
      const logger = await loadLogger('production')

      logger.error('Error loading watchlist', new TypeError('fetch is not a function'))
      await flush()

      const [, context] = captureError.mock.calls[0]
      expect(context).toEqual({ name: 'TypeError', message: 'fetch is not a function' })
    })

    it('reports without a cause when the caller has no Error to give', async () => {
      const logger = await loadLogger('production')

      logger.error('Analytics data error', { error: 'timeout' })
      await flush()

      const [reported] = captureError.mock.calls[0]
      expect((reported as Error).cause).toBeUndefined()
    })

    it('does not lose a cause that itself has a cause', async () => {
      const logger = await loadLogger('production')
      const root = new Error('ECONNREFUSED')
      const wrapper = new Error('Upstream unavailable', { cause: root })

      logger.error('Error checking portfolio state', wrapper)
      await flush()

      const [reported] = captureError.mock.calls[0]
      expect((reported as Error).cause).toBe(wrapper)
      expect(((reported as Error).cause as Error).cause).toBe(root)
    })
  })

  describe('severity routing', () => {
    it('sends a warning as a message, not as an exception', async () => {
      // A warning must not open an error issue. This is what turned expected
      // platform limitations into unresolved issues in the stream.
      const logger = await loadLogger('production')

      logger.warn('Push messaging is not supported in this browser')
      await flush()

      expect(captureError).not.toHaveBeenCalled()
      expect(logMessage).toHaveBeenCalledWith(
        'Push messaging is not supported in this browser',
        'warning'
      )
    })

    it('does not report info at all', async () => {
      const logger = await loadLogger('production')

      logger.info('Notifications not supported in this environment')
      await flush()

      expect(captureError).not.toHaveBeenCalled()
      expect(logMessage).not.toHaveBeenCalled()
    })

    it('does not report debug at all', async () => {
      const logger = await loadLogger('production')

      logger.debug('cache miss')
      await flush()

      expect(captureError).not.toHaveBeenCalled()
      expect(logMessage).not.toHaveBeenCalled()
    })
  })

  describe('outside production', () => {
    it('reports nothing, so local runs do not consume the event quota', async () => {
      const logger = await loadLogger('development')

      logger.error('Error checking portfolio state', new Error('boom'))
      logger.warn('something')
      await flush()

      expect(captureError).not.toHaveBeenCalled()
      expect(logMessage).not.toHaveBeenCalled()
    })

    it('still prints the original stack to the console', async () => {
      const logger = await loadLogger('development')
      const original = new Error('boom')

      logger.error('Error checking portfolio state', original)

      expect(console.error).toHaveBeenCalledWith(original.stack)
    })
  })
})
