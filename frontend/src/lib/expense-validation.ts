/**
 * Shared validation helpers for expense forms (add, edit, receipt scanner)
 */

/** Positive amounts with up to 2 decimal places */
export const AMOUNT_INPUT_REGEX = /^\d*\.?\d{0,2}$/

/**
 * Input filter for amount fields — allows empty string (so the field can be
 * cleared) or an in-progress positive number with up to 2 decimal places
 */
export function isValidAmountInput(value: string): boolean {
  return value === "" || AMOUNT_INPUT_REGEX.test(value)
}

export type ExpenseAmountValidation =
  | { ok: true; value: number }
  | { ok: false; error: string }

/**
 * Validate a raw amount string at submit time.
 * Returns the parsed numeric value when valid, or an error message when not.
 */
export function validateExpenseAmount(raw: string): ExpenseAmountValidation {
  const trimmed = raw.trim()

  if (!trimmed) {
    return { ok: false, error: "Amount is required" }
  }

  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, error: "Please enter a valid amount greater than 0" }
  }

  return { ok: true, value: parsed }
}
