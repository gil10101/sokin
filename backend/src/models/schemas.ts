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
    merchant: Joi.string().allow(''),
    confidence: Joi.number().min(0).max(1),
    items: Joi.array().items(Joi.string()),
    rawText: Joi.string().allow('')
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
    merchant: Joi.string().allow(''),
    confidence: Joi.number().min(0).max(1),
    items: Joi.array().items(Joi.string()),
    rawText: Joi.string().allow('')
  }).allow(null)
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