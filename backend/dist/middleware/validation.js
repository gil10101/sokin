"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.validateParams = exports.validateBody = void 0;
/**
 * Validate request body against a Joi schema
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true, convert: true });
        if (error) {
            return res.status(400).json({ error: 'Validation failed', details: error.details });
        }
        req.body = value;
        next();
    };
};
exports.validateBody = validateBody;
/**
 * Validate request params against a Joi schema
 * Stores validated params in req.validatedParams to preserve Express type safety
 * Also updates req.params with string-coerced values for backwards compatibility
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, { abortEarly: false, stripUnknown: true, convert: true });
        if (error) {
            return res.status(400).json({ error: 'Validation failed', details: error.details });
        }
        // Store validated params in separate property to maintain type safety
        req.validatedParams = value;
        // Also update req.params with string-coerced values for backwards compatibility
        // This ensures existing controller code continues to work
        const stringParams = {};
        Object.keys(value).forEach(key => {
            const val = value[key];
            // Convert all values to strings for Express params compatibility
            stringParams[key] = val !== null && val !== undefined ? String(val) : '';
        });
        Object.assign(req.params, stringParams);
        next();
    };
};
exports.validateParams = validateParams;
/**
 * Backwards compatibility: existing code uses `validate` for body validation
 */
exports.validate = exports.validateBody;
