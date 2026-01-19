"use strict";
/**
 * Validation Middleware
 *
 * Provides request validation using Joi schemas.
 * Validates request body and URL parameters with consistent error responses.
 *
 * Features:
 * - Body validation with automatic sanitization
 * - Parameter validation with type coercion
 * - Consistent error response format
 * - Type-safe validated params storage
 *
 * @module middleware/validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.validateQuery = exports.validateParams = exports.validateBody = void 0;
/**
 * Validate request body against a Joi schema
 *
 * Validates the request body and replaces it with the validated/sanitized value.
 * Unknown properties are stripped, and values are coerced to their expected types.
 *
 * @param schema - Joi schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { createExpenseSchema } from '../models/schemas';
 *
 * router.post('/', validateBody(createExpenseSchema), createExpense);
 * ```
 *
 * @example Schema definition
 * ```typescript
 * const createExpenseSchema = Joi.object({
 *   name: Joi.string().required().trim(),
 *   amount: Joi.number().required().positive(),
 *   date: Joi.string().isoDate().required(),
 *   category: Joi.string().required().trim(),
 * });
 * ```
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Collect all errors, not just the first
            stripUnknown: true, // Remove unknown properties for security
            convert: true // Coerce values to expected types
        });
        if (error) {
            const response = {
                error: 'Validation failed',
                details: error.details
            };
            res.status(400).json(response);
            return;
        }
        // Replace body with validated/sanitized value
        req.body = value;
        next();
    };
};
exports.validateBody = validateBody;
/**
 * Validate URL parameters against a Joi schema
 *
 * Validates URL parameters and stores validated values in req.validatedParams.
 * Also updates req.params with string-coerced values for backwards compatibility.
 *
 * @param schema - Joi schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { idParamsSchema } from '../models/schemas';
 *
 * router.get('/:id', validateParams(idParamsSchema), getExpenseById);
 *
 * // In controller
 * const id = req.validatedParams?.id as string;
 * // Or using req.params (string)
 * const id = req.params.id;
 * ```
 *
 * @example Schema definition
 * ```typescript
 * const idParamsSchema = Joi.object({
 *   id: Joi.string().trim().min(8).max(128).required()
 * });
 * ```
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
        if (error) {
            const response = {
                error: 'Validation failed',
                details: error.details
            };
            res.status(400).json(response);
            return;
        }
        // Store validated params in separate property for type safety
        req.validatedParams = value;
        // Also update req.params with string-coerced values for backwards compatibility
        const stringParams = {};
        Object.keys(value).forEach(key => {
            const val = value[key];
            stringParams[key] = val !== null && val !== undefined ? String(val) : '';
        });
        Object.assign(req.params, stringParams);
        next();
    };
};
exports.validateParams = validateParams;
/**
 * Validate request query parameters against a Joi schema
 *
 * @param schema - Joi schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const paginationSchema = Joi.object({
 *   limit: Joi.number().integer().min(1).max(100).default(50),
 *   cursor: Joi.string().optional()
 * });
 *
 * router.get('/', validateQuery(paginationSchema), getAllExpenses);
 * ```
 */
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
        if (error) {
            const response = {
                error: 'Validation failed',
                details: error.details
            };
            res.status(400).json(response);
            return;
        }
        // Store validated query in separate property for type safety
        // Also update req.query for backwards compatibility (Express ParsedQs typing is flexible)
        req.validatedQuery = value;
        req.query = value;
        next();
    };
};
exports.validateQuery = validateQuery;
/**
 * Backwards compatibility alias for validateBody
 *
 * @deprecated Use validateBody instead
 * @param schema - Joi schema to validate against
 * @returns Express middleware function
 */
exports.validate = exports.validateBody;
