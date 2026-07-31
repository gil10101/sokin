import React from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, within, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import DashboardLayout from './layout'
import SettingsPage from './settings/page'
import NotificationsPage from './notifications/page'

const STORAGE_KEY = 'sokin:sidebar-collapsed'

/**
 * jsdom 29 hands back a null-prototype stub for window.localStorage in this
 * setup (no getItem/setItem/clear), so the persistence the layout relies on has
 * to be supplied here or these tests would assert against a no-op.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear() { this.store.clear() }
  getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null }
  removeItem(key: string) { this.store.delete(key) }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
}

Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})

/**
 * ProtectedRoute refuses to render children until auth resolves, and the sidebar
 * reads the signed-in user, so the mock hands back a settled user. The value has
 * a stable identity because the pages' fetch effects key on it.
 */
const { authValue } = vi.hoisted(() => ({
  authValue: {
    user: { uid: 'test-uid', displayName: 'Ada Lovelace', email: 'ada@example.com', photoURL: null },
    userData: { settings: { currency: 'USD' } },
    loading: false,
    signOut: vi.fn(),
    updateUserSettings: vi.fn(),
    refreshUserData: vi.fn(),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => authValue,
}))

vi.mock('@/contexts/notifications-context', () => ({
  useNotifications: () => ({
    notifications: [],
    isLoading: false,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    dismissNotification: vi.fn(),
    dismissAllNotifications: vi.fn(),
    deleteNotification: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  notificationsAPI: {
    getNotificationPreferences: vi.fn().mockResolvedValue({}),
    updateNotificationPreferences: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

const pathname = { current: '/dashboard/settings' }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => pathname.current,
  useSearchParams: () => new URLSearchParams(),
}))

/** `<aside>` maps to the complementary role, and the sidebar is the only aside. */
const sidebars = () => screen.queryAllByRole('complementary')

const mountAt = async (path: string, page: React.ReactElement): Promise<RenderResult> => {
  pathname.current = path
  let result!: RenderResult
  // act() flushes the pages' async settings fetch so effects settle before asserting.
  await act(async () => {
    result = render(<DashboardLayout>{page}</DashboardLayout>)
  })
  return result
}

/**
 * App Router keeps layout.tsx mounted across sibling routes and swaps only the
 * page beneath it, so a navigation is the same layout element re-rendered with
 * different children.
 */
const navigateTo = async (
  rerender: RenderResult['rerender'],
  path: string,
  page: React.ReactElement,
) => {
  pathname.current = path
  await act(async () => {
    rerender(<DashboardLayout>{page}</DashboardLayout>)
  })
}

beforeEach(() => {
  window.localStorage.clear()
  pathname.current = '/dashboard/settings'
})

describe('DashboardLayout sidebar ownership', () => {
  it('renders exactly one sidebar around a page that no longer renders its own', async () => {
    await mountAt('/dashboard/settings', <SettingsPage />)

    expect(sidebars()).toHaveLength(1)
    // Populated, i.e. not the old childless `mounted === false` placeholder.
    expect(within(sidebars()[0]).getAllByRole('link').length).toBeGreaterThan(5)
    expect(within(sidebars()[0]).getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })

  it('reserves the mobile hamburger strip once, on the layout content wrapper', async () => {
    await mountAt('/dashboard/settings', <SettingsPage />)

    const pageMain = screen.getByRole('main')
    expect(pageMain.parentElement?.className).toContain('pt-16')
    expect(pageMain.parentElement?.className).toContain('md:pt-0')
    // The page keeps its own scroll container inside that wrapper.
    expect(pageMain.className).toContain('overflow-auto')
  })

  it('keeps the same sidebar DOM node across a route change', async () => {
    const { rerender } = await mountAt('/dashboard/settings', <SettingsPage />)

    const before = sidebars()[0]
    expect(before).toBeInTheDocument()

    await navigateTo(rerender, '/dashboard/notifications', <NotificationsPage />)

    // The new page mounted...
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    // ...and the sidebar did not: same element, so no unmount/remount flash.
    expect(sidebars()).toHaveLength(1)
    expect(sidebars()[0]).toBe(before)
  })

  it('keeps the collapsed state across a route change', async () => {
    const user = userEvent.setup()
    const { rerender } = await mountAt('/dashboard/settings', <SettingsPage />)

    expect(sidebars()[0]).toHaveStyle({ width: '200px' })

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(sidebars()[0]).toHaveStyle({ width: '100px' })

    await navigateTo(rerender, '/dashboard/notifications', <NotificationsPage />)

    expect(sidebars()[0]).toHaveStyle({ width: '100px' })
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('persists the collapsed preference and restores it on the next mount', async () => {
    const user = userEvent.setup()
    const first = await mountAt('/dashboard/settings', <SettingsPage />)

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true')

    first.unmount()
    await mountAt('/dashboard/settings', <SettingsPage />)

    // Applied before paint, so there is no expanded-then-collapsed flash.
    expect(sidebars()[0]).toHaveStyle({ width: '100px' })
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
  })

  it('still renders when localStorage throws', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled')
    })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled')
    })

    const user = userEvent.setup()
    await mountAt('/dashboard/settings', <SettingsPage />)

    expect(sidebars()).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(sidebars()[0]).toHaveStyle({ width: '100px' })
  })
})

/**
 * The DOM tests above can only observe the two pages they render. This walks
 * every dashboard page, so a sidebar (or a hand-rolled hamburger offset) copied
 * back into any of the other twelve fails the suite as well.
 */
describe('dashboard pages delegate chrome to the layout', () => {
  const pageFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return pageFiles(full)
      return entry.name === 'page.tsx' ? [full] : []
    })

  const files = pageFiles(__dirname)

  it('finds every dashboard page', () => {
    expect(files).toHaveLength(14)
  })

  it.each(files)('%s renders no sidebar of its own', (file) => {
    expect(readFileSync(file, 'utf8')).not.toContain('DashboardSidebar')
  })

  it.each(files)('%s does not hand-roll the hamburger offset', (file) => {
    expect(readFileSync(file, 'utf8')).not.toContain('ml-12 md:ml-0')
  })
})
