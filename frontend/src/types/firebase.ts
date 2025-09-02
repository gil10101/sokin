/**
 * Firebase-related type definitions for Sokin application
 */

import { Timestamp } from 'firebase/firestore'

/**
 * Firebase Timestamp interface for proper typing
 */
export interface FirebaseTimestamp {
  seconds: number
  nanoseconds: number
  toDate(): Date
  toJSON(): string
  isEqual(other: FirebaseTimestamp): boolean
  valueOf(): string
}

/**
 * Type guard to check if a value is a Firebase Timestamp
 */
export function isFirebaseTimestamp(value: unknown): value is Timestamp {
  return (
    value != null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as any).toDate === 'function' &&
    'seconds' in value &&
    'nanoseconds' in value
  )
}

/**
 * Safely converts various date formats to Date object
 */
export function safeParseDate(dateValue: unknown): Date {
  if (!dateValue) return new Date()

  try {
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue
    }

    // If it's a Firebase Timestamp object
    if (isFirebaseTimestamp(dateValue)) {
      return dateValue.toDate()
    }

    // If it's a numeric timestamp (milliseconds)
    if (typeof dateValue === 'number') {
      return new Date(dateValue)
    }

    // If it's a string
    if (typeof dateValue === 'string') {
      const parsedDate = new Date(dateValue)
      return isNaN(parsedDate.getTime()) ? new Date() : parsedDate
    }

    return new Date()
  } catch {
    return new Date()
  }
}

/**
 * Date-related types for expenses and transactions
 */
export type DateValue = Date | Timestamp | string | number | null | undefined
