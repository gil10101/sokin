import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The bug: `getMessaging()` runs its own support check as a floating promise
 * and throws from inside it (see @firebase/messaging's `getMessagingInWindow`).
 * A try/catch around the call catches nothing - the failure arrives later as an
 * unhandled rejection, which is how it reached Sentry as an unhandled error on
 * every page load for a signed-in visitor on iOS Safari.
 *
 * So the assertion that matters is not "we handled the throw" but "we never
 * called `getMessaging` on a browser that cannot support it".
 */

const getMessaging = vi.fn()
const getToken = vi.fn()
const onMessage = vi.fn()
const isSupported = vi.fn()

vi.mock('firebase/messaging', () => ({
  getMessaging: (...args: unknown[]) => getMessaging(...args),
  getToken: (...args: unknown[]) => getToken(...args),
  onMessage: (...args: unknown[]) => onMessage(...args),
  isSupported: () => isSupported(),
}))

vi.mock('./firebase', () => ({
  auth: { app: { name: 'test-app' }, currentUser: null },
}))

const loggerError = vi.fn()
const loggerWarn = vi.fn()
const loggerInfo = vi.fn()

vi.mock('./logger', () => ({
  logger: {
    error: (...a: unknown[]) => loggerError(...a),
    warn: (...a: unknown[]) => loggerWarn(...a),
    info: (...a: unknown[]) => loggerInfo(...a),
    debug: () => {},
  },
}))

async function load() {
  vi.resetModules()
  return import('./firebase-messaging')
}

describe('firebase messaging on a browser without push support', () => {
  beforeEach(() => {
    getMessaging.mockReset()
    getToken.mockReset()
    onMessage.mockReset()
    isSupported.mockReset()
    loggerError.mockClear()
    loggerWarn.mockClear()
    loggerInfo.mockClear()
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
  })

  it('never calls getMessaging when the browser is unsupported', async () => {
    isSupported.mockResolvedValue(false)
    const { requestNotificationPermission } = await load()

    await requestNotificationPermission()

    // This is the whole fix. Calling it would arm a rejection that no caller
    // can catch, whatever the surrounding error handling looks like.
    expect(getMessaging).not.toHaveBeenCalled()
  })

  it('resolves to null rather than throwing', async () => {
    isSupported.mockResolvedValue(false)
    const { requestNotificationPermission } = await load()

    await expect(requestNotificationPermission()).resolves.toBeNull()
  })

  it('does not log the unsupported browser as an error', async () => {
    // An iPhone is a supported visitor, not a fault. Logging at warn or above
    // forwards it to the error tracker, which is what filled the issue stream.
    isSupported.mockResolvedValue(false)
    const { requestNotificationPermission } = await load()

    await requestNotificationPermission()

    expect(loggerError).not.toHaveBeenCalled()
    expect(loggerWarn).not.toHaveBeenCalled()
    expect(loggerInfo).toHaveBeenCalledWith('Push messaging is not supported in this browser')
  })

  it('returns an inert unsubscribe from the foreground listener', async () => {
    isSupported.mockResolvedValue(false)
    const { setupForegroundMessageListener } = await load()

    const unsubscribe = await setupForegroundMessageListener(() => {})

    expect(onMessage).not.toHaveBeenCalled()
    expect(() => unsubscribe()).not.toThrow()
  })

  it('asks the browser only once, however many callers there are', async () => {
    // isSupported probes IndexedDB; re-running it per call is wasted work, and
    // an unsupported browser will not become supported mid-session.
    isSupported.mockResolvedValue(false)
    const { requestNotificationPermission, setupForegroundMessageListener } = await load()

    await requestNotificationPermission()
    await requestNotificationPermission()
    await setupForegroundMessageListener(() => {})

    expect(isSupported).toHaveBeenCalledTimes(1)
  })
})

describe('firebase messaging on a browser with push support', () => {
  beforeEach(() => {
    getMessaging.mockReset()
    getToken.mockReset()
    onMessage.mockReset()
    isSupported.mockReset()
    loggerError.mockClear()
    loggerWarn.mockClear()
    loggerInfo.mockClear()
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') })
  })

  it('initialises messaging and returns the token', async () => {
    isSupported.mockResolvedValue(true)
    getMessaging.mockReturnValue({ id: 'messaging' })
    getToken.mockResolvedValue('fcm-token')
    const { requestNotificationPermission } = await load()

    await expect(requestNotificationPermission()).resolves.toBe('fcm-token')
    expect(getMessaging).toHaveBeenCalledTimes(1)
  })

  it('passes the resolved instance to getToken, not a stale binding', async () => {
    // The instance used to come from a synchronous helper; when that became a
    // promise, handing the promise to getToken would silently misbehave.
    isSupported.mockResolvedValue(true)
    const instance = { id: 'messaging' }
    getMessaging.mockReturnValue(instance)
    getToken.mockResolvedValue('fcm-token')
    const { requestNotificationPermission } = await load()

    await requestNotificationPermission()

    expect(getToken.mock.calls[0][0]).toBe(instance)
  })

  it('subscribes the foreground listener to the resolved instance', async () => {
    isSupported.mockResolvedValue(true)
    const instance = { id: 'messaging' }
    getMessaging.mockReturnValue(instance)
    onMessage.mockReturnValue(() => {})
    const { setupForegroundMessageListener } = await load()

    await setupForegroundMessageListener(() => {})

    expect(onMessage.mock.calls[0][0]).toBe(instance)
  })

  it('creates the messaging instance once across callers', async () => {
    isSupported.mockResolvedValue(true)
    getMessaging.mockReturnValue({ id: 'messaging' })
    getToken.mockResolvedValue('fcm-token')
    onMessage.mockReturnValue(() => {})
    const { requestNotificationPermission, setupForegroundMessageListener } = await load()

    await requestNotificationPermission()
    await setupForegroundMessageListener(() => {})

    expect(getMessaging).toHaveBeenCalledTimes(1)
  })

  it('reports a genuine initialisation failure as an error', async () => {
    // A supported browser that still fails to initialise is a real fault and
    // must not be swallowed alongside the expected-unsupported case.
    isSupported.mockResolvedValue(true)
    getMessaging.mockImplementation(() => {
      throw new Error('app/no-app')
    })
    const { requestNotificationPermission } = await load()

    await expect(requestNotificationPermission()).resolves.toBeNull()
    expect(loggerError).toHaveBeenCalledWith(
      'Failed to initialize Firebase messaging',
      { error: 'app/no-app' }
    )
  })
})
