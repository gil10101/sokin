"use strict";
/**
 * Collection of helper utility functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeUndefined = exports.groupBy = exports.getNestedValue = exports.safeJsonParse = exports.generateId = exports.formatCurrency = void 0;
// Format money amount with currency symbol
const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
    }).format(amount);
};
exports.formatCurrency = formatCurrency;
// Generate a unique ID (simple implementation)
const generateId = (prefix = '') => {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
};
exports.generateId = generateId;
// Safely parse JSON string to object
const safeJsonParse = (jsonString, defaultValue) => {
    try {
        return JSON.parse(jsonString);
    }
    catch (error) {
        return defaultValue;
    }
};
exports.safeJsonParse = safeJsonParse;
// Safely access nested object properties
const getNestedValue = (obj, path, defaultValue) => {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined || !current.hasOwnProperty(part)) {
            return defaultValue;
        }
        current = current[part];
    }
    return current;
};
exports.getNestedValue = getNestedValue;
// Group an array of objects by a given key
const groupBy = (array, key) => {
    return array.reduce((result, item) => {
        const groupKey = item[key] || 'undefined';
        result[groupKey] = result[groupKey] || [];
        result[groupKey].push(item);
        return result;
    }, {});
};
exports.groupBy = groupBy;
// Remove undefined properties from an object
const removeUndefined = (obj) => {
    return Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .reduce((result, [key, value]) => {
        result[key] = value;
        return result;
    }, {});
};
exports.removeUndefined = removeUndefined;
