import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import ExpensesPage from './page'

const getExpensesMock = vi.fn()
const deleteExpenseMock = vi.fn()
const addNotificationMock = vi.fn()
const toastMock = vi.fn()
const pushMock = vi.fn()

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  expensesAPI: {
    getExpenses: (...args: unknown[]) => getExpensesMock(...args),
    deleteExpense: (...args: unknown[]) => deleteExpenseMock(...args),
  },
}))

/**
 * The page's fetch effect keys on the `user` object identity, so the mock has
 * to hand back the same reference every render or the effect loops forever.
 */
const { authValue } = vi.hoisted(() => ({
  authValue: {
    user: { uid: 'test-uid', getIdToken: async () => 'test-token' },
    userData: { settings: { currency: 'USD' } },
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => authValue,
}))

vi.mock('@/contexts/notifications-context', () => ({
  useNotifications: () => ({ addNotification: addNotificationMock }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/dashboard/expenses',
  useSearchParams: () => new URLSearchParams(),
}))

const EXPENSES = [
  { id: 'exp-coffee', name: 'Coffee', amount: 4.5, category: 'Dining', date: '2026-07-20T10:00:00.000Z', createdAt: '2026-07-20T10:00:00.000Z', userId: 'test-uid' },
  { id: 'exp-rent', name: 'Rent', amount: 1800, category: 'Housing', date: '2026-07-01T10:00:00.000Z', createdAt: '2026-07-01T10:00:00.000Z', userId: 'test-uid' },
  { id: 'exp-gym', name: 'Gym', amount: 45, category: 'Health', date: '2026-07-05T10:00:00.000Z', createdAt: '2026-07-05T10:00:00.000Z', userId: 'test-uid' },
]

/** The desktop table and the mobile card list both render in jsdom, since they
 * are hidden by CSS breakpoints only. Assertions pick one deliberately. */
function desktopTable(): HTMLElement {
  return screen.getByRole('table')
}

function mobileList(container: HTMLElement): HTMLElement {
  const list = container.querySelector('div.md\\:hidden')
  if (!list) throw new Error('Mobile card list was not rendered')
  return list as HTMLElement
}

function openDialog(): HTMLElement {
  const dialogs = screen.getAllByRole('alertdialog')
  expect(dialogs).toHaveLength(1)
  return dialogs[0]
}

async function renderPage() {
  const utils = render(<ExpensesPage />)
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
  await waitFor(() => expect(within(desktopTable()).getByText('Rent')).toBeInTheDocument())
  return utils
}

beforeEach(() => {
  getExpensesMock.mockReset()
  deleteExpenseMock.mockReset()
  addNotificationMock.mockReset()
  toastMock.mockReset()
  pushMock.mockReset()

  getExpensesMock.mockResolvedValue({ items: EXPENSES, nextCursor: null, hasMore: false })
  deleteExpenseMock.mockResolvedValue({ success: true })
  addNotificationMock.mockResolvedValue(undefined)
})

describe('ExpensesPage - one delete confirmation, scoped to its row', () => {
  it('opens a single dialog when a desktop row delete is clicked', async () => {
    await renderPage()

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Rent' }))

    // Each row used to carry its own AlertDialog whose trigger ALSO set the
    // pending id, so this click opened the row dialog and the page dialog.
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  })

  it('names the row the dialog was opened from', async () => {
    await renderPage()

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Rent' }))

    const dialog = openDialog()
    expect(within(dialog).getByText(/"Rent"/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/"Coffee"/)).not.toBeInTheDocument()
  })

  it('dismisses fully on Cancel and deletes nothing', async () => {
    await renderPage()

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Rent' }))
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'Cancel' }))

    // With two stacked dialogs, dismissing one left the other on screen.
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteExpenseMock).not.toHaveBeenCalled()
    expect(within(desktopTable()).getByText('Rent')).toBeInTheDocument()
  })

  it('deletes the row the dialog was opened from, and only that row', async () => {
    await renderPage()

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Rent' }))
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteExpenseMock).toHaveBeenCalledTimes(1))
    expect(deleteExpenseMock).toHaveBeenCalledWith('exp-rent')

    await waitFor(() => expect(within(desktopTable()).queryByText('Rent')).not.toBeInTheDocument())
    expect(within(desktopTable()).getByText('Coffee')).toBeInTheDocument()
    expect(within(desktopTable()).getByText('Gym')).toBeInTheDocument()
  })

  it('targets the newly clicked row after a cancelled attempt', async () => {
    await renderPage()

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Rent' }))
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Coffee' }))
    const dialog = openDialog()
    expect(within(dialog).getByText(/"Coffee"/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteExpenseMock).toHaveBeenCalledWith('exp-coffee'))
    expect(deleteExpenseMock).toHaveBeenCalledTimes(1)
  })

  it('scopes the mobile card control to its own row too', async () => {
    const { container } = await renderPage()

    fireEvent.click(within(mobileList(container)).getByRole('button', { name: 'Delete Gym' }))

    const dialog = openDialog()
    expect(within(dialog).getByText(/"Gym"/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteExpenseMock).toHaveBeenCalledWith('exp-gym'))
    expect(deleteExpenseMock).toHaveBeenCalledTimes(1)
  })

  it('does not expand the row behind the dialog when deleting', async () => {
    await renderPage()

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Rent' }))
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

    // The row's own onClick toggles a details panel; the delete button must
    // not fall through to it.
    expect(screen.queryByText('No description provided')).not.toBeInTheDocument()
  })

  it('keeps the row when the delete request fails', async () => {
    deleteExpenseMock.mockRejectedValue(new Error('network down'))
    await renderPage()

    fireEvent.click(within(desktopTable()).getByRole('button', { name: 'Delete Rent' }))
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error deleting expense', variant: 'destructive' })
      )
    )
    expect(within(desktopTable()).getByText('Rent')).toBeInTheDocument()
  })
})
