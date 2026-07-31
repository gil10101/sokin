import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isWebGLAvailable, resetWebGLAvailabilityCache } from './webgl'

const realGetContext = HTMLCanvasElement.prototype.getContext

beforeEach(() => {
  resetWebGLAvailabilityCache()
})

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext
  vi.unstubAllGlobals()
})

function stubGetContext(impl: (type: string) => unknown) {
  HTMLCanvasElement.prototype.getContext = vi.fn(impl) as unknown as typeof realGetContext
}

describe('isWebGLAvailable', () => {
  it('reports true when the browser returns a context', () => {
    stubGetContext((type) => (type === 'webgl2' ? { getExtension: () => null } : null))
    expect(isWebGLAvailable()).toBe(true)
  })

  it('falls back through webgl and experimental-webgl', () => {
    const seen: string[] = []
    stubGetContext((type) => {
      seen.push(type)
      return type === 'experimental-webgl' ? { getExtension: () => null } : null
    })
    expect(isWebGLAvailable()).toBe(true)
    expect(seen).toEqual(['webgl2', 'webgl', 'experimental-webgl'])
  })

  it('reports false when no context can be created', () => {
    // This is the case that threw "Error creating WebGL context" from three.js
    // and took the landing page down instead of degrading.
    stubGetContext(() => null)
    expect(isWebGLAvailable()).toBe(false)
  })

  it('reports false rather than propagating a throwing getContext', () => {
    stubGetContext(() => {
      throw new Error('WebGL blocked by policy')
    })
    expect(() => isWebGLAvailable()).not.toThrow()
    expect(isWebGLAvailable()).toBe(false)
  })

  it('releases the probe context so it does not count against the browser limit', () => {
    const loseContext = vi.fn()
    stubGetContext(() => ({ getExtension: () => ({ loseContext }) }))
    isWebGLAvailable()
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('still reports true when releasing the probe throws', () => {
    // Canvas-fingerprinting defences throw from getExtension. Failing to hand
    // the probe context back is a leak; it is not evidence that the browser
    // cannot do WebGL. Letting it decide the answer would blank the landing
    // page for a machine that renders fine - and permanently, since the answer
    // is cached for the rest of the session.
    stubGetContext(() => ({
      getExtension: () => {
        throw new Error('getExtension blocked')
      },
    }))

    expect(isWebGLAvailable()).toBe(true)
    expect(isWebGLAvailable()).toBe(true)
  })

  it('still reports true when loseContext itself throws', () => {
    stubGetContext(() => ({
      getExtension: () => ({
        loseContext: () => {
          throw new Error('context already lost')
        },
      }),
    }))

    expect(isWebGLAvailable()).toBe(true)
  })

  it('probes once and caches the answer', () => {
    stubGetContext(() => ({ getExtension: () => null }))
    isWebGLAvailable()
    isWebGLAvailable()
    isWebGLAvailable()
    // 3 calls would mean one probe; more would mean it re-probed.
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(1)
  })

  it('caches a negative answer too', () => {
    stubGetContext(() => null)
    expect(isWebGLAvailable()).toBe(false)
    expect(isWebGLAvailable()).toBe(false)
    // webgl2 + webgl + experimental-webgl on the first call only.
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(3)
  })
})
