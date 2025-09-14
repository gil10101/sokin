import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Extend Express Request interface to include validated parameters
declare global {
  namespace Express {
    interface Request {
      validatedParams?: Record<string, any>;
    }
  }
}

/**
 * Validate request body against a Joi schema
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true, convert: true });
    if (error) {
      return res.status(400).json({ error: 'Validation failed', details: error.details });
    }
    req.body = value;
    next();
  };
};

/**
 * Validate request params against a Joi schema
 * Stores validated params in req.validatedParams to preserve Express type safety
 * Also updates req.params with string-coerced values for backwards compatibility
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false, stripUnknown: true, convert: true });
    if (error) {
      return res.status(400).json({ error: 'Validation failed', details: error.details });
    }
    
    // Store validated params in separate property to maintain type safety
    req.validatedParams = value;
    
    // Also update req.params with string-coerced values for backwards compatibility
    // This ensures existing controller code continues to work
    const stringParams: Record<string, string> = {};
    Object.keys(value).forEach(key => {
      const val = value[key];
      // Convert all values to strings for Express params compatibility
      stringParams[key] = val !== null && val !== undefined ? String(val) : '';
    });
    Object.assign(req.params, stringParams);
    
    next();
  };
};

/**
 * Backwards compatibility: existing code uses `validate` for body validation
 */
export const validate = validateBody;