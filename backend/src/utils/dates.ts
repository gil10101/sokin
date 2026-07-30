import { AppError } from '../middleware/errorHandler';

/**
 * Normalize a date value to an ISO string.
 * Accepts Date objects and date strings.
 * Throws AppError with 400 status for invalid dates.
 */
export const normalizeIsoDate = (value: unknown, fieldName: string): string => {
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName} date`, 400, true);
  }
  return date.toISOString();
};
