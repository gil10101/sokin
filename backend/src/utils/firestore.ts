export type FirestoreTimestamp = {
  toDate: () => Date;
};

export const normalizeDateValue = (
  value: unknown
): string | null | undefined => {
  if (value === null) return null;
  if (value === undefined) return undefined;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && value && 'toDate' in value) {
    const date = (value as FirestoreTimestamp).toDate();
    return date instanceof Date ? date.toISOString() : undefined;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return undefined;
};

export const normalizeDateFields = <T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): T => {
  const normalized = { ...data };

  fields.forEach((field) => {
    const value = normalized[field];
    const isoValue = normalizeDateValue(value);
    if (isoValue !== undefined) {
      normalized[field] = isoValue as T[keyof T];
    }
  });

  return normalized;
};
