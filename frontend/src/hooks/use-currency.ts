"use client"

import { useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { formatCurrency, formatCompactCurrency, type CurrencyOptions } from "@/lib/format"

/**
 * Currency formatter bound to the signed-in user's currency setting, so the
 * Settings > Currency selector actually changes what the app renders.
 */
export function useCurrency() {
  const { userData } = useAuth()
  const currency = userData?.settings?.currency || "USD"

  const format = useCallback(
    (amount: number, options: Omit<CurrencyOptions, "currency"> = {}) =>
      formatCurrency(amount, { ...options, currency }),
    [currency]
  )

  const formatCompact = useCallback(
    (amount: number) => formatCompactCurrency(amount, { currency }),
    [currency]
  )

  return { currency, format, formatCompact }
}
