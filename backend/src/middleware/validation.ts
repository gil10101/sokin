import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessage = error.details.map((detail: Joi.ValidationErrorItem) => detail.message).join(', ');
      return res.status(400).json({ error: errorMessage });
    }
    
    next();
  };
}; 