import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SavingsGoals } from './savings-goals'

const getGoalsMock = vi.fn()
const addContributionMock = vi.fn()
const updateGoalMock = vi.fn()
const createGoalMock = vi.fn()
const toastMock = vi.fn()

vi.mock('@/lib/api', () => ({
  goalsAPI: {
    getGoals: (...args: unknown[]) => getGoalsMock(...args),
    addContribution: (...args: unknown[]) => addContributionMock(...args),
    updateGoal: (...args: unknown[]) => updateGoalMock(...args),
    createGoal: (...args: unknown[]) => createGoalMock(...args),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', getIdToken: async () => 'test-token' },
    userData: { settings: { currency: 'USD' } },
  }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

type Goal = {
  id: string
  userId: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  category: string
  priority: 'low' | 'medium' | 'high'
  isCompleted: boolean
  createdAt: string
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    userId: 'test-uid',
    name: 'Widget Verify Fund',
    targetAmount: 1000,
    currentAmount: 200,
    targetDate: '2027-07-30T00:00:00.000Z',
    category: 'emergency',
    priority: 'medium',
    isCompleted: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderWidget() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <SavingsGoals />
    </QueryClientProvider>
  )
}

/**
 * Radix marks the body pointer-events:none while a modal is open, which
 * user-event's default actionability check reads as "not clickable". The
 * dialog is genuinely interactive, so the check is disabled rather than the
 * clicks being faked with fireEvent.
 */
function setupUser(): UserEvent {
  return userEvent.setup({ pointerEventsCheck: 0 })
}

/** Drives the real widget UI: open "Add Money", fill it in, submit. */
async function contributeViaWidget(
  user: UserEvent,
  { amount, note }: { amount: string; note?: string }
) {
  await user.click(await screen.findByRole('button', { name: /add money/i }))
  await user.type(await screen.findByLabelText('Amount *'), amount)
  if (note) {
    await user.type(screen.getByLabelText('Note (Optional)'), note)
  }
  await user.click(screen.getByRole('button', { name: /^Add \$/ }))
}

function toastTitles(): string[] {
  return toastMock.mock.calls.map((call) => call[0]?.title)
}

beforeEach(() => {
  getGoalsMock.mockReset()
  addContributionMock.mockReset()
  updateGoalMock.mockReset()
  createGoalMock.mockReset()
  toastMock.mockReset()

  // Default: the write succeeds and the refetch reports the server's new total.
  addContributionMock.mockResolvedValue({ currentAmount: 300, isCompleted: false })
  updateGoalMock.mockResolvedValue(goal())
  getGoalsMock.mockResolvedValue([goal()])
})

describe('SavingsGoals - contribution reaches the endpoint that moves money', () => {
  it('posts to the transactional contribute endpoint, never the update endpoint', async () => {
    // PUT goals/:id whitelists name/description/targetAmount/targetDate/
    // category/priority server-side and drops currentAmount, so it answers 200
    // while the balance stays put. Only addContribution actually increments it.
    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100' })

    await waitFor(() => expect(addContributionMock).toHaveBeenCalledTimes(1))
    expect(addContributionMock).toHaveBeenCalledWith(
      'goal-1',
      expect.objectContaining({ amount: 100, method: 'manual', source: 'Manual Entry' })
    )
    expect(updateGoalMock).not.toHaveBeenCalled()
  })

  it('sends the amount as a number, not the raw input string', async () => {
    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '137.50' })

    await waitFor(() => expect(addContributionMock).toHaveBeenCalledTimes(1))
    const [, payload] = addContributionMock.mock.calls[0]
    expect(payload.amount).toBe(137.5)
    expect(typeof payload.amount).toBe('number')
  })

  it('forwards the Note the dialog collects instead of discarding it', async () => {
    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100', note: 'Bonus money' })

    await waitFor(() => expect(addContributionMock).toHaveBeenCalledTimes(1))
    expect(addContributionMock).toHaveBeenCalledWith(
      'goal-1',
      expect.objectContaining({ note: 'Bonus money' })
    )
  })

  it('omits the note entirely when the field is left blank', async () => {
    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100' })

    await waitFor(() => expect(addContributionMock).toHaveBeenCalledTimes(1))
    const [, payload] = addContributionMock.mock.calls[0]
    expect(payload.note).toBeUndefined()
  })

  it('refreshes from the server after the write so the card shows the stored balance', async () => {
    // The server is the authority on the new total. Here it reports 250 where
    // local arithmetic (200 + 100) would have shown 300.
    getGoalsMock.mockReset()
    getGoalsMock
      .mockResolvedValueOnce([goal({ currentAmount: 200 })])
      .mockResolvedValue([goal({ currentAmount: 250 })])

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100' })

    await waitFor(() => expect(screen.getByText('$250')).toBeInTheDocument())
    expect(screen.queryByText('$300')).not.toBeInTheDocument()
    expect(getGoalsMock).toHaveBeenCalledTimes(2)
  })
})

describe('SavingsGoals - a failed write is never reported as success', () => {
  it('shows a destructive error toast and no success toast when the write rejects', async () => {
    addContributionMock.mockRejectedValue(new Error('HTTP 500: Failed to add contribution'))

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100' })

    await waitFor(() => expect(toastMock).toHaveBeenCalled())
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        description: 'HTTP 500: Failed to add contribution',
        variant: 'destructive',
      })
    )
    expect(toastTitles()).not.toContain('Contribution Added')
    expect(toastTitles()).not.toContain('Goal Completed')
  })

  it('does not refetch or clear the form when the write rejects', async () => {
    // Losing the typed amount would make a retry needlessly annoying, and a
    // refetch after a failed write only redraws the same numbers.
    addContributionMock.mockRejectedValue(new Error('network down'))

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100', note: 'Bonus money' })

    await waitFor(() => expect(addContributionMock).toHaveBeenCalledTimes(1))
    expect(getGoalsMock).toHaveBeenCalledTimes(1)
    expect(await screen.findByLabelText('Amount *')).toHaveValue(100)
    expect(screen.getByLabelText('Note (Optional)')).toHaveValue('Bonus money')
  })

  it('reports a rejection with no Error message as a contribution failure', async () => {
    addContributionMock.mockRejectedValue('boom')

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100' })

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Failed to add contribution',
          variant: 'destructive',
        })
      )
    )
    expect(toastTitles()).not.toContain('Contribution Added')
  })
})

describe('SavingsGoals - milestones follow the stored balance', () => {
  it('does not celebrate completion when the stored balance is short of target', async () => {
    // Local arithmetic would read 900 + 200 = 1100 and declare the goal met.
    // The server stored 950, so there is nothing to celebrate.
    getGoalsMock.mockReset()
    getGoalsMock
      .mockResolvedValueOnce([goal({ currentAmount: 900 })])
      .mockResolvedValue([goal({ currentAmount: 950 })])

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '200' })

    await waitFor(() => expect(toastTitles()).toContain('Contribution Added'))
    expect(toastTitles()).not.toContain('Goal Completed')
  })

  it('celebrates completion once the stored balance reaches the target', async () => {
    getGoalsMock.mockReset()
    getGoalsMock
      .mockResolvedValueOnce([goal({ currentAmount: 900 })])
      .mockResolvedValue([goal({ currentAmount: 1100, isCompleted: true })])

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '200' })

    await waitFor(() => expect(toastTitles()).toContain('Goal Completed'))
  })

  it('announces a crossed milestone using the stored balance', async () => {
    getGoalsMock.mockReset()
    getGoalsMock
      .mockResolvedValueOnce([goal({ currentAmount: 400 })])
      .mockResolvedValue([goal({ currentAmount: 550 })])

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '150' })

    await waitFor(() => expect(toastTitles()).toContain('Progress Update'))
    expect(toastTitles()).not.toContain('Goal Completed')
  })

  it('does not re-announce a milestone that was already crossed', async () => {
    getGoalsMock.mockReset()
    getGoalsMock
      .mockResolvedValueOnce([goal({ currentAmount: 600 })])
      .mockResolvedValue([goal({ currentAmount: 700 })])

    const user = setupUser()
    renderWidget()

    await contributeViaWidget(user, { amount: '100' })

    await waitFor(() => expect(toastTitles()).toContain('Contribution Added'))
    expect(toastTitles()).not.toContain('Progress Update')
    expect(toastTitles()).not.toContain('Milestone Achieved')
  })
})
