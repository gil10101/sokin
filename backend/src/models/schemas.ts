import Joi from 'joi';

// Expense schemas
export const createExpenseSchema = Joi.object({
  name: Joi.string().required().trim(),
  amount: Joi.number().required().positive(),
  date: Joi.string().isoDate().required(),
  category: Joi.string().required().trim(),
  description: Joi.string().allow(''),
  tags: Joi.array().items(Joi.string()),
  receiptImageUrl: Joi.string().uri().allow(''),
  receiptData: Joi.object({
    merchant: Joi.string().allow(null, ''),
    confidence: Joi.number().min(0).max(1),
    items: Joi.array().items(Joi.string()),
    rawText: Joi.string().allow(null, '')
  }).allow(null)
});

export const updateExpenseSchema = Joi.object({
  name: Joi.string().trim(),
  amount: Joi.number().positive(),
  date: Joi.string().isoDate(),
  category: Joi.string().trim(),
  description: Joi.string().allow(''),
  tags: Joi.array().items(Joi.string()),
  receiptImageUrl: Joi.string().uri().allow(''),
  receiptData: Joi.object({
    merchant: Joi.string().allow(null, ''),
    confidence: Joi.number().min(0).max(1),
    items: Joi.array().items(Joi.string()),
    rawText: Joi.string().allow(null, '')
  }).allow(null)
}).min(1);

// Budget schemas
export const createBudgetSchema = Joi.object({
  name: Joi.string().trim(),
  category: Joi.string().required().trim(),
  amount: Joi.number().required().positive(),
  period: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly', 'custom').required(),
  categories: Joi.array().items(Joi.string()),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().allow(null, '').when('period', {
    is: 'custom',
    then: Joi.string().isoDate().disallow(null, '').required()
  }),
  notes: Joi.string().allow(null, '').max(1000)
});

export const updateBudgetSchema = Joi.object({
  name: Joi.string().trim(),
  category: Joi.string().trim(),
  amount: Joi.number().positive(),
  period: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly', 'custom'),
  categories: Joi.array().items(Joi.string()),
  startDate: Joi.string().isoDate(),
  endDate: Joi.string().isoDate().allow(null, '').when('period', {
    is: 'custom',
    then: Joi.string().isoDate().disallow(null, '').required()
  }),
  notes: Joi.string().allow(null, '').max(1000)
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

// Notification schemas
export const markNotificationReadParamsSchema = Joi.object({
  notificationId: Joi.string().trim().min(8).max(128).required()
});

export const updateNotificationPreferencesSchema = Joi.object({
  budgetAlerts: Joi.boolean(),
  billReminders: Joi.boolean(),
  goalMilestones: Joi.boolean(),
  spendingInsights: Joi.boolean(),
  pushNotifications: Joi.boolean(),
  emailNotifications: Joi.boolean(),
  budgetWarningThreshold: Joi.number().min(0).max(100),
  budgetExceededThreshold: Joi.number().min(0).max(100),
  reminderDaysBefore: Joi.number().min(0).max(30)
}).min(1);

export const registerFcmTokenSchema = Joi.object({
  token: Joi.string().trim().min(20).max(4096).required(),
  platform: Joi.string().valid('web', 'ios', 'android').required()
});

export const createNotificationSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  message: Joi.string().trim().min(1).max(1000).required(),
  type: Joi.string().valid(
    'budget_warning', 'budget_exceeded', 'bill_reminder',
    'goal_milestone', 'goal_achieved', 'spending_insight',
    'monthly_report', 'info', 'warning', 'error', 'success', 'system'
  ).required(),
  data: Joi.object().pattern(Joi.string(), Joi.string().max(500)).optional(),
  link: Joi.alternatives().try(
    Joi.string().uri({ allowRelative: true }).max(500),
    Joi.string().pattern(/^\/[\w\-./?=&#%]*$/).max(500)
  ).optional()
});

export const createSubscriptionSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  amount: Joi.number().positive().required(),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'semi-annually', 'annually', 'custom').required(),
  customInterval: Joi.number().integer().min(1).max(365).optional(),
  customIntervalUnit: Joi.string().valid('days', 'weeks', 'months', 'years').optional(),
  startDate: Joi.string().isoDate().required(),
  nextPaymentDate: Joi.string().isoDate().required(),
  paymentMethod: Joi.string().trim().min(1).max(100).required(),
  category: Joi.string().trim().min(1).max(100).required(),
  autoRenew: Joi.boolean().required(),
  logo: Joi.string().uri().optional().allow(''),
  website: Joi.string().uri().optional().allow(''),
  notes: Joi.string().allow('').max(2000).optional()
});

export const updateSubscriptionSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  amount: Joi.number().positive(),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'semi-annually', 'annually', 'custom'),
  customInterval: Joi.number().integer().min(1).max(365),
  customIntervalUnit: Joi.string().valid('days', 'weeks', 'months', 'years'),
  startDate: Joi.string().isoDate(),
  nextPaymentDate: Joi.string().isoDate(),
  paymentMethod: Joi.string().trim().min(1).max(100),
  category: Joi.string().trim().min(1).max(100),
  autoRenew: Joi.boolean(),
  logo: Joi.string().uri().optional().allow(''),
  website: Joi.string().uri().optional().allow(''),
  notes: Joi.string().allow('').max(2000).optional()
}).min(1);

// Bill reminder schemas
export const createBillReminderSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  amount: Joi.number().positive().required(),
  dueDate: Joi.string().isoDate().required(),
  frequency: Joi.string().valid('weekly', 'monthly', 'quarterly', 'yearly', 'one-time').required(),
  category: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().allow('').max(1000).optional(),
  isPaid: Joi.boolean().optional(),
  reminderDays: Joi.array().items(Joi.number().integer().min(0).max(60)).optional(),
  autoPayEnabled: Joi.boolean().optional(),
  linkedAccount: Joi.string().allow('').optional()
});

export const updateBillReminderSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  amount: Joi.number().positive(),
  dueDate: Joi.string().isoDate(),
  frequency: Joi.string().valid('weekly', 'monthly', 'quarterly', 'yearly', 'one-time'),
  category: Joi.string().trim().min(1).max(100),
  description: Joi.string().allow('').max(1000),
  isPaid: Joi.boolean(),
  reminderDays: Joi.array().items(Joi.number().integer().min(0).max(60)),
  autoPayEnabled: Joi.boolean(),
  linkedAccount: Joi.string().allow('')
}).min(1);

// Goal schemas
export const createGoalSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  targetAmount: Joi.number().positive().required(),
  currentAmount: Joi.number().min(0).optional(),
  targetDate: Joi.string().isoDate().required(),
  category: Joi.string().valid('emergency', 'vacation', 'home', 'car', 'education', 'retirement', 'other').required(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  description: Joi.string().allow('').max(1000).optional(),
  milestones: Joi.array().items(Joi.object({
    percentage: Joi.number().min(0).max(100).required(),
    amount: Joi.number().min(0).required()
  })).optional()
});

export const updateGoalSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  targetAmount: Joi.number().positive(),
  currentAmount: Joi.number().min(0),
  targetDate: Joi.string().isoDate(),
  category: Joi.string().valid('emergency', 'vacation', 'home', 'car', 'education', 'retirement', 'other'),
  priority: Joi.string().valid('low', 'medium', 'high'),
  description: Joi.string().allow('').max(1000)
}).min(1);

export const contributeGoalSchema = Joi.object({
  amount: Joi.number().positive().required(),
  note: Joi.string().allow('').optional(),
  method: Joi.string().valid('manual', 'automatic', 'roundup').optional(),
  source: Joi.string().allow('').optional()
});

// Asset schemas
export const createAssetSchema = Joi.object({
  type: Joi.string().required().valid(
    // Bank Accounts
    'checking', 'savings', 'money_market', 'cd',
    // Investment Accounts
    'stocks', 'crypto', 'retirement_401k', 'retirement_ira', 'mutual_funds', 'bonds', 'brokerage',
    // Real Estate
    'primary_residence', 'rental_property', 'commercial_property', 'land',
    // Vehicles
    'car', 'truck', 'motorcycle', 'boat', 'rv',
    // Other Valuables
    'collectibles', 'business_ownership', 'jewelry', 'art', 'other'
  ),
  category: Joi.string().required().valid(
    'bank_accounts', 'investment_accounts', 'real_estate', 'vehicles', 'other_valuables'
  ),
  name: Joi.string().required().trim().min(1).max(100),
  currentValue: Joi.number().required().min(0).max(1000000000),
  description: Joi.string().allow('').max(500),
  metadata: Joi.object({
    // Bank Account specific
    bankName: Joi.string().trim().max(100),
    accountType: Joi.string().trim().max(50),
    accountNumber: Joi.string().trim().max(50),
    
    // Investment specific  
    platform: Joi.string().trim().max(100),
    investmentType: Joi.string().trim().max(50),
    ticker: Joi.string().trim().max(10),
    shares: Joi.number().min(0),
    
    // Real Estate specific
    address: Joi.string().trim().max(200),
    propertyType: Joi.string().trim().max(50),
    purchasePrice: Joi.number().min(0),
    purchaseDate: Joi.string().isoDate(),
    mortgageBalance: Joi.number().min(0),
    
    // Vehicle specific
    make: Joi.string().trim().max(50),
    model: Joi.string().trim().max(50),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1),
    mileage: Joi.number().min(0),
    vin: Joi.string().trim().max(17),
    
    // General
    notes: Joi.string().allow('').max(1000),
    lastValuationDate: Joi.string().isoDate(),
    valuationMethod: Joi.string().valid('manual', 'api', 'estimated')
  }).allow(null)
});

export const updateAssetSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  currentValue: Joi.number().min(0).max(1000000000),
  description: Joi.string().allow('').max(500),
  metadata: Joi.object({
    // Bank Account specific
    bankName: Joi.string().trim().max(100),
    accountType: Joi.string().trim().max(50),
    accountNumber: Joi.string().trim().max(50),
    
    // Investment specific  
    platform: Joi.string().trim().max(100),
    investmentType: Joi.string().trim().max(50),
    ticker: Joi.string().trim().max(10),
    shares: Joi.number().min(0),
    
    // Real Estate specific
    address: Joi.string().trim().max(200),
    propertyType: Joi.string().trim().max(50),
    purchasePrice: Joi.number().min(0),
    purchaseDate: Joi.string().isoDate(),
    mortgageBalance: Joi.number().min(0),
    
    // Vehicle specific
    make: Joi.string().trim().max(50),
    model: Joi.string().trim().max(50),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1),
    mileage: Joi.number().min(0),
    vin: Joi.string().trim().max(17),
    
    // General
    notes: Joi.string().allow('').max(1000),
    lastValuationDate: Joi.string().isoDate(),
    valuationMethod: Joi.string().valid('manual', 'api', 'estimated')
  }).allow(null)
}).min(1);

// Liability schemas
export const createLiabilitySchema = Joi.object({
  type: Joi.string().required().valid(
    // Credit Cards
    'credit_card', 'store_card', 'business_card',
    // Mortgages
    'primary_mortgage', 'second_mortgage', 'heloc',
    // Student Loans
    'federal_student_loan', 'private_student_loan',
    // Auto Loans
    'car_loan', 'truck_loan', 'motorcycle_loan',
    // Personal Loans
    'personal_loan', 'payday_loan', 'medical_debt',
    // Other
    'business_loan', 'family_loan', 'other'
  ),
  category: Joi.string().required().valid(
    'credit_cards', 'mortgages', 'student_loans', 'auto_loans', 'personal_loans', 'other_debts'
  ),
  name: Joi.string().required().trim().min(1).max(100),
  currentBalance: Joi.number().required().min(0).max(1000000000),
  originalAmount: Joi.number().optional().min(0).max(1000000000),
  interestRate: Joi.number().optional().min(0).max(100),
  minimumPayment: Joi.number().optional().min(0).max(100000),
  dueDate: Joi.string().optional().isoDate(),
  metadata: Joi.object({
    // Credit Card specific
    creditLimit: Joi.number().min(0),
    issuer: Joi.string().trim().max(100),
    cardNumber: Joi.string().trim().max(50),
    
    // Loan specific
    lender: Joi.string().trim().max(100),
    loanTerm: Joi.number().integer().min(1).max(600), // months
    payoffDate: Joi.string().isoDate(),
    
    // Mortgage specific
    propertyAddress: Joi.string().trim().max(200),
    
    // General
    accountNumber: Joi.string().trim().max(50),
    notes: Joi.string().allow('').max(1000),
    autoPayEnabled: Joi.boolean(),
    linkedBankAccount: Joi.string().trim().max(50)
  }).allow(null).optional()
});

export const updateLiabilitySchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  currentBalance: Joi.number().min(0).max(1000000000),
  interestRate: Joi.number().min(0).max(100),
  minimumPayment: Joi.number().min(0).max(100000),
  dueDate: Joi.string().isoDate(),
  metadata: Joi.object({
    // Credit Card specific
    creditLimit: Joi.number().min(0),
    issuer: Joi.string().trim().max(100),
    cardNumber: Joi.string().trim().max(50),
    
    // Loan specific
    lender: Joi.string().trim().max(100),
    loanTerm: Joi.number().integer().min(1).max(600), // months
    payoffDate: Joi.string().isoDate(),
    
    // Mortgage specific
    propertyAddress: Joi.string().trim().max(200),
    
    // General
    accountNumber: Joi.string().trim().max(50),
    notes: Joi.string().allow('').max(1000),
    autoPayEnabled: Joi.boolean(),
    linkedBankAccount: Joi.string().trim().max(50)
  }).allow(null)
}).min(1);

// ID validation schema for path parameters
export const idParamsSchema = Joi.object({
  id: Joi.string().trim().min(8).max(128).required()
});

// Goal ID validation schema for path parameters
export const goalIdParamsSchema = Joi.object({
  goalId: Joi.string().trim().min(8).max(128).required()
});

// Bill reminder ID validation schema for path parameters
export const billIdParamsSchema = Joi.object({
  billId: Joi.string().trim().min(8).max(128).required()
});

// User ID validation schema for path parameters (Firebase UID format)
export const userIdParamsSchema = Joi.object({
  userId: Joi.string()
    .trim()
    .pattern(/^[a-zA-Z0-9_-]{20,128}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required'
    })
});

// Stock symbol validation schema for path parameters
export const stockSymbolParamsSchema = Joi.object({
  symbol: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(10)
    .pattern(/^[A-Z^]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid stock symbol format',
      'any.required': 'Stock symbol is required'
    })
});

// Pagination query parameters schema
export const paginationQuerySchema = Joi.object({
  /** Number of items to return (1-100, default: 50) */
  limit: Joi.number().integer().min(1).max(100).default(50),
  /** Cursor for pagination (document ID to start after) */
  cursor: Joi.string().trim().min(8).max(128).optional(),
  /** Sort order: 'asc' or 'desc' (default: 'desc') */
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  /** Field to sort by (default: 'date' for expenses, 'createdAt' for others) */
  sortBy: Joi.string().valid('date', 'createdAt', 'amount', 'name').default('date')
});

// Expenses-specific pagination with date filtering
export const expensesPaginationSchema = paginationQuerySchema.keys({
  /** Filter by category */
  category: Joi.string().trim().max(50).optional(),
  /** Filter by start date (ISO format) */
  startDate: Joi.string().isoDate().optional(),
  /** Filter by end date (ISO format) */
  endDate: Joi.string().isoDate().optional()
}).custom((value, helpers) => {
  // Validate that endDate is not before startDate
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    return helpers.error('any.invalid', { message: 'endDate must be after or equal to startDate' });
  }
  return value;
}, 'date range validation').messages({
  'any.invalid': 'endDate must be after or equal to startDate'
});

// Budgets-specific pagination
export const budgetsPaginationSchema = paginationQuerySchema.keys({
  /** Filter by period type */
  period: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional(),
  /** Filter active budgets only */
  activeOnly: Joi.boolean().default(false)
}).keys({
  sortBy: Joi.string().valid('createdAt', 'amount', 'name', 'startDate').default('createdAt')
});