/**
 * Collection of helper utility functions
 */

// Format money amount with currency symbol
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
};

// Generate a unique ID (simple implementation)
export const generateId = (prefix: string = ''): string => {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
};

// Safely parse JSON string to object
export const safeJsonParse = <T>(jsonString: string, defaultValue: T): T => {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    return defaultValue;
  }
};

// Safely access nested object properties
export const getNestedValue = <T>(
  obj: Record<string, any>,
  path: string,
  defaultValue: T
): T => {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined || !current.hasOwnProperty(part)) {
      return defaultValue;
    }
    current = current[part];
  }

  return current as T;
};

// Group an array of objects by a given key
export const groupBy = <T>(
  array: T[],
  key: string
): Record<string, T[]> => {
  return array.reduce((result, item) => {
    const groupKey = (item as Record<string, unknown>)[key] as string || 'undefined';
    result[groupKey] = result[groupKey] || [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
};

// Remove undefined properties from an object
export const removeUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  return Object.entries(obj)
    .filter(([_, value]) => value !== undefined)
    .reduce((result, [key, value]) => {
      result[key as keyof T] = value as T[keyof T];
      return result;
    }, {} as Partial<T>);
}; 