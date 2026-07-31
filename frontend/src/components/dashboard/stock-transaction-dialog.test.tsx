import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransactionDialog } from './stock-transaction-dialog'
import type { StockData } from '@/lib/stock-api'

const getMaxSellAmount = vi.fn()

// Mocked wholesale rather than via importActual: the real module initialises
// the Firebase client at import time and throws without live credentials.
vi.mock('@/lib/stock-api', () => ({
  StockAPI: { getMaxSellAmount: (...a: unknown[]) => getMaxSellAmount(...a) },
  formatPrice: (n: number) => `$${n.toFixed(2)}`,
  formatPercent: (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`,
}))

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

const STOCK: StockData = {
  symbol: 'MSFT',
  name: 'Microsoft Corporation',
  price: 100,
  change: 1,
  changePercent: 1,
  volume: 1000,
  avgVolume: 1000,
  marketCap: '3T',
  peRatio: 30,
  weekHigh52: 120,
  weekLow52: 80,
  weekChange52: 10,
}

const USER = { uid: 'u1' } as never

beforeEach(() => {
  getMaxSellAmount.mockReset()
  getMaxSellAmount.mockResolvedValue({ shares: 10, value: 1000, price: 100 })
})

function renderDialog(mode: 'trade' | 'add', onSubmit = vi.fn()) {
  const utils = render(
    <TransactionDialog
      stock={STOCK}
      isOpen
      onClose={vi.fn()}
      onSubmit={onSubmit}
      user={USER}
      mode={mode}
    />
  )
  return { ...utils, onSubmit }
}

/** The action button is labelled "Buy $x" / "Sell $x". */
function actionButton(): HTMLElement {
  const btn = screen
    .getAllByRole('button')
    .find((b) => /^(Buy|Sell)\s\$/.test((b.textContent || '').trim()))
  if (!btn) throw new Error('No Buy/Sell action button rendered')
  return btn
}

describe('TransactionDialog - "add" can never sell', () => {
  it('submits a buy in add mode', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderDialog('add')

    await user.type(screen.getByLabelText(/Amount/i), '250')
    await user.click(actionButton())

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ symbol: 'MSFT', type: 'buy' })
  })

  it('does not offer a Buy/Sell choice in add mode', () => {
    renderDialog('add')
    expect(screen.queryByRole('button', { name: /^sell$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Add MSFT to Portfolio/)).toBeInTheDocument()
  })

  it('switches to buy when a live instance flips from trade to add', async () => {
    // This is the shape of the real bug: the page kept ONE dialog instance
    // mounted and only changed its `mode` prop, so a 'sell' chosen during a
    // trade survived into the next "Add MSFT to Portfolio" open - which
    // rendered no toggle to reveal it and sold a held position instead of
    // buying. Re-rendering the same instance (not remounting) is what makes
    // this a real regression guard: a fresh mount would reset the state and
    // pass even against the broken version.
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    const props = {
      stock: STOCK,
      isOpen: true,
      onClose: vi.fn(),
      onSubmit,
      user: USER,
    }
    const { rerender } = render(<TransactionDialog {...props} mode="trade" />)

    await user.click(screen.getByRole('button', { name: /^sell$/i }))
    await waitFor(() => expect(actionButton().textContent).toMatch(/^Sell/))

    rerender(<TransactionDialog {...props} mode="add" />)

    expect(actionButton().textContent).toMatch(/^Buy/)
    expect(screen.queryByRole('button', { name: /^sell$/i })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/Amount/i), '100')
    await user.click(actionButton())

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: 'buy' })
  })
})

describe('TransactionDialog - trade mode', () => {
  it('defaults to buy', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderDialog('trade')

    expect(actionButton().textContent).toMatch(/^Buy/)
    await user.type(screen.getByLabelText(/Amount/i), '300')
    await user.click(actionButton())

    expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: 'buy' })
  })

  it('submits a sell when the user explicitly chooses sell', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderDialog('trade')

    await user.click(screen.getByRole('button', { name: /^sell$/i }))
    await waitFor(() => expect(actionButton().textContent).toMatch(/^Sell/))

    await user.type(screen.getByLabelText(/Amount/i), '300')
    await user.click(actionButton())

    expect(onSubmit.mock.calls[0][0]).toMatchObject({ type: 'sell' })
  })

  it('does not load sell limits while buying', async () => {
    renderDialog('trade')
    await waitFor(() => expect(actionButton()).toBeInTheDocument())
    expect(getMaxSellAmount).not.toHaveBeenCalled()
  })

  it('loads the sell limit once sell is selected', async () => {
    const user = userEvent.setup()
    renderDialog('trade')

    await user.click(screen.getByRole('button', { name: /^sell$/i }))
    await waitFor(() => expect(getMaxSellAmount).toHaveBeenCalledWith('u1', 'MSFT'))
  })

  it('refuses to sell more than the position is worth', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderDialog('trade')

    await user.click(screen.getByRole('button', { name: /^sell$/i }))
    await waitFor(() => expect(getMaxSellAmount).toHaveBeenCalled())

    // Position is worth 1000; try to sell 5000.
    await user.type(screen.getByLabelText(/Amount/i), '5000')
    await user.click(actionButton())

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('TransactionDialog - fresh state per opening', () => {
  it('starts each mount with an empty amount', async () => {
    const user = userEvent.setup()
    const first = renderDialog('trade')
    await user.type(screen.getByLabelText(/Amount/i), '999')
    expect(screen.getByLabelText(/Amount/i)).toHaveValue(999)
    first.unmount()

    // The page now mounts the dialog only while open, so a reopen is a fresh
    // mount and cannot inherit the previous transaction's amount.
    renderDialog('trade')
    const input = screen.getByLabelText(/Amount/i) as HTMLInputElement
    expect(input.value === '' || input.value === '0').toBe(true)
  })

  it('ignores a submit with no amount entered', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderDialog('add')
    await user.click(actionButton())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
