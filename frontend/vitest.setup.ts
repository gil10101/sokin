import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

/**
 * jsdom implements neither of these, and recharts' ResponsiveContainer plus
 * several Radix primitives call them during render. Without the stubs charts
 * mount at 0x0 and render no series, which would make chart assertions pass
 * or fail for reasons unrelated to the code under test.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

if (!window.matchMedia) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  )
}
