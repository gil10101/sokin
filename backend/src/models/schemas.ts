import Joi from 'joi';

// Expense schemas
export const createExpenseSchema = Joi.object({
  amount: Joi.number().required().positive(),
  date: Joi.string().isoDate().required(),
  category: Joi.string().required().trim(),
  description: Joi.string().allow(''),
  tags: Joi.array().items(Joi.string())
});

export const updateExpenseSchema = Joi.object({
  amount: Joi.number().positive(),
  date: Joi.string().isoDate(),
  category: Joi.string().trim(),
  description: Joi.string().allow(''),
  tags: Joi.array().items(Joi.string())
}).min(1);

// Budget schemas
export const createBudgetSchema = Joi.object({
  name: Joi.string().required().trim(),
  amount: Joi.number().required().positive(),
  period: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
  categories: Joi.array().items(Joi.string()),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate()
});

export const updateBudgetSchema = Joi.object({
  name: Joi.string().trim(),
  amount: Joi.number().positive(),
  period: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly'),
  categories: Joi.array().items(Joi.string()),
  startDate: Joi.string().isoDate(),
  endDate: Joi.string().isoDate()
}).min(1);

// User schemas
export const updateUserSchema = Joi.object({
  displayName: Joi.string().trim(),
  photoURL: Joi.string().uri(),
  settings: Joi.object({
    currency: Joi.string().trim(),
    language: Joi.string().trim(),
    theme: Joi.string().valid('light', 'dark'),
    notificationsEnabled: Joi.boolean()
  })
}).min(1); 