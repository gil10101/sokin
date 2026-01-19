"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.budgetsPaginationSchema = exports.expensesPaginationSchema = exports.paginationQuerySchema = exports.stockSymbolParamsSchema = exports.userIdParamsSchema = exports.idParamsSchema = exports.updateLiabilitySchema = exports.createLiabilitySchema = exports.updateAssetSchema = exports.createAssetSchema = exports.registerFcmTokenSchema = exports.updateNotificationPreferencesSchema = exports.markNotificationReadParamsSchema = exports.updateUserSchema = exports.updateBudgetSchema = exports.createBudgetSchema = exports.updateExpenseSchema = exports.createExpenseSchema = void 0;
const joi_1 = __importDefault(require("joi"));
// Expense schemas
exports.createExpenseSchema = joi_1.default.object({
    name: joi_1.default.string().required().trim(),
    amount: joi_1.default.number().required().positive(),
    date: joi_1.default.string().isoDate().required(),
    category: joi_1.default.string().required().trim(),
    description: joi_1.default.string().allow(''),
    tags: joi_1.default.array().items(joi_1.default.string()),
    receiptImageUrl: joi_1.default.string().uri().allow(''),
    receiptData: joi_1.default.object({
        merchant: joi_1.default.string().allow(''),
        confidence: joi_1.default.number().min(0).max(1),
        items: joi_1.default.array().items(joi_1.default.string()),
        rawText: joi_1.default.string().allow('')
    }).allow(null)
});
exports.updateExpenseSchema = joi_1.default.object({
    name: joi_1.default.string().trim(),
    amount: joi_1.default.number().positive(),
    date: joi_1.default.string().isoDate(),
    category: joi_1.default.string().trim(),
    description: joi_1.default.string().allow(''),
    tags: joi_1.default.array().items(joi_1.default.string()),
    receiptImageUrl: joi_1.default.string().uri().allow(''),
    receiptData: joi_1.default.object({
        merchant: joi_1.default.string().allow(''),
        confidence: joi_1.default.number().min(0).max(1),
        items: joi_1.default.array().items(joi_1.default.string()),
        rawText: joi_1.default.string().allow('')
    }).allow(null)
}).min(1);
// Budget schemas
exports.createBudgetSchema = joi_1.default.object({
    name: joi_1.default.string().required().trim(),
    amount: joi_1.default.number().required().positive(),
    period: joi_1.default.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
    categories: joi_1.default.array().items(joi_1.default.string()),
    startDate: joi_1.default.string().isoDate().required(),
    endDate: joi_1.default.string().isoDate()
});
exports.updateBudgetSchema = joi_1.default.object({
    name: joi_1.default.string().trim(),
    amount: joi_1.default.number().positive(),
    period: joi_1.default.string().valid('daily', 'weekly', 'monthly', 'yearly'),
    categories: joi_1.default.array().items(joi_1.default.string()),
    startDate: joi_1.default.string().isoDate(),
    endDate: joi_1.default.string().isoDate()
}).min(1);
// User schemas
exports.updateUserSchema = joi_1.default.object({
    displayName: joi_1.default.string().trim(),
    photoURL: joi_1.default.string().uri(),
    settings: joi_1.default.object({
        currency: joi_1.default.string().trim(),
        language: joi_1.default.string().trim(),
        theme: joi_1.default.string().valid('light', 'dark'),
        notificationsEnabled: joi_1.default.boolean()
    })
}).min(1);
// Notification schemas
exports.markNotificationReadParamsSchema = joi_1.default.object({
    notificationId: joi_1.default.string().trim().min(8).max(128).required()
});
exports.updateNotificationPreferencesSchema = joi_1.default.object({
    notificationsEnabled: joi_1.default.boolean().required(),
    push: joi_1.default.boolean(),
    email: joi_1.default.boolean(),
    sms: joi_1.default.boolean()
}).min(1);
exports.registerFcmTokenSchema = joi_1.default.object({
    token: joi_1.default.string().trim().min(20).max(4096).required(),
    platform: joi_1.default.string().valid('web', 'ios', 'android').required()
});
// Asset schemas
exports.createAssetSchema = joi_1.default.object({
    type: joi_1.default.string().required().valid(
    // Bank Accounts
    'checking', 'savings', 'money_market', 'cd', 
    // Investment Accounts
    'stocks', 'crypto', 'retirement_401k', 'retirement_ira', 'mutual_funds', 'bonds', 'brokerage', 
    // Real Estate
    'primary_residence', 'rental_property', 'commercial_property', 'land', 
    // Vehicles
    'car', 'truck', 'motorcycle', 'boat', 'rv', 
    // Other Valuables
    'collectibles', 'business_ownership', 'jewelry', 'art', 'other'),
    category: joi_1.default.string().required().valid('bank_accounts', 'investment_accounts', 'real_estate', 'vehicles', 'other_valuables'),
    name: joi_1.default.string().required().trim().min(1).max(100),
    currentValue: joi_1.default.number().required().min(0).max(1000000000),
    description: joi_1.default.string().allow('').max(500),
    metadata: joi_1.default.object({
        // Bank Account specific
        bankName: joi_1.default.string().trim().max(100),
        accountType: joi_1.default.string().trim().max(50),
        accountNumber: joi_1.default.string().trim().max(50),
        // Investment specific  
        platform: joi_1.default.string().trim().max(100),
        investmentType: joi_1.default.string().trim().max(50),
        ticker: joi_1.default.string().trim().max(10),
        shares: joi_1.default.number().min(0),
        // Real Estate specific
        address: joi_1.default.string().trim().max(200),
        propertyType: joi_1.default.string().trim().max(50),
        purchasePrice: joi_1.default.number().min(0),
        purchaseDate: joi_1.default.string().isoDate(),
        mortgageBalance: joi_1.default.number().min(0),
        // Vehicle specific
        make: joi_1.default.string().trim().max(50),
        model: joi_1.default.string().trim().max(50),
        year: joi_1.default.number().integer().min(1900).max(new Date().getFullYear() + 1),
        mileage: joi_1.default.number().min(0),
        vin: joi_1.default.string().trim().max(17),
        // General
        notes: joi_1.default.string().allow('').max(1000),
        lastValuationDate: joi_1.default.string().isoDate(),
        valuationMethod: joi_1.default.string().valid('manual', 'api', 'estimated')
    }).allow(null)
});
exports.updateAssetSchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(100),
    currentValue: joi_1.default.number().min(0).max(1000000000),
    description: joi_1.default.string().allow('').max(500),
    metadata: joi_1.default.object({
        // Bank Account specific
        bankName: joi_1.default.string().trim().max(100),
        accountType: joi_1.default.string().trim().max(50),
        accountNumber: joi_1.default.string().trim().max(50),
        // Investment specific  
        platform: joi_1.default.string().trim().max(100),
        investmentType: joi_1.default.string().trim().max(50),
        ticker: joi_1.default.string().trim().max(10),
        shares: joi_1.default.number().min(0),
        // Real Estate specific
        address: joi_1.default.string().trim().max(200),
        propertyType: joi_1.default.string().trim().max(50),
        purchasePrice: joi_1.default.number().min(0),
        purchaseDate: joi_1.default.string().isoDate(),
        mortgageBalance: joi_1.default.number().min(0),
        // Vehicle specific
        make: joi_1.default.string().trim().max(50),
        model: joi_1.default.string().trim().max(50),
        year: joi_1.default.number().integer().min(1900).max(new Date().getFullYear() + 1),
        mileage: joi_1.default.number().min(0),
        vin: joi_1.default.string().trim().max(17),
        // General
        notes: joi_1.default.string().allow('').max(1000),
        lastValuationDate: joi_1.default.string().isoDate(),
        valuationMethod: joi_1.default.string().valid('manual', 'api', 'estimated')
    }).allow(null)
}).min(1);
// Liability schemas
exports.createLiabilitySchema = joi_1.default.object({
    type: joi_1.default.string().required().valid(
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
    'business_loan', 'family_loan', 'other'),
    category: joi_1.default.string().required().valid('credit_cards', 'mortgages', 'student_loans', 'auto_loans', 'personal_loans', 'other_debts'),
    name: joi_1.default.string().required().trim().min(1).max(100),
    currentBalance: joi_1.default.number().required().min(0).max(1000000000),
    originalAmount: joi_1.default.number().optional().min(0).max(1000000000),
    interestRate: joi_1.default.number().optional().min(0).max(100),
    minimumPayment: joi_1.default.number().optional().min(0).max(100000),
    dueDate: joi_1.default.string().optional().isoDate(),
    metadata: joi_1.default.object({
        // Credit Card specific
        creditLimit: joi_1.default.number().min(0),
        issuer: joi_1.default.string().trim().max(100),
        cardNumber: joi_1.default.string().trim().max(50),
        // Loan specific
        lender: joi_1.default.string().trim().max(100),
        loanTerm: joi_1.default.number().integer().min(1).max(600), // months
        payoffDate: joi_1.default.string().isoDate(),
        // Mortgage specific
        propertyAddress: joi_1.default.string().trim().max(200),
        // General
        accountNumber: joi_1.default.string().trim().max(50),
        notes: joi_1.default.string().allow('').max(1000),
        autoPayEnabled: joi_1.default.boolean(),
        linkedBankAccount: joi_1.default.string().trim().max(50)
    }).allow(null).optional()
});
exports.updateLiabilitySchema = joi_1.default.object({
    name: joi_1.default.string().trim().min(1).max(100),
    currentBalance: joi_1.default.number().min(0).max(1000000000),
    interestRate: joi_1.default.number().min(0).max(100),
    minimumPayment: joi_1.default.number().min(0).max(100000),
    dueDate: joi_1.default.string().isoDate(),
    metadata: joi_1.default.object({
        // Credit Card specific
        creditLimit: joi_1.default.number().min(0),
        issuer: joi_1.default.string().trim().max(100),
        cardNumber: joi_1.default.string().trim().max(50),
        // Loan specific
        lender: joi_1.default.string().trim().max(100),
        loanTerm: joi_1.default.number().integer().min(1).max(600), // months
        payoffDate: joi_1.default.string().isoDate(),
        // Mortgage specific
        propertyAddress: joi_1.default.string().trim().max(200),
        // General
        accountNumber: joi_1.default.string().trim().max(50),
        notes: joi_1.default.string().allow('').max(1000),
        autoPayEnabled: joi_1.default.boolean(),
        linkedBankAccount: joi_1.default.string().trim().max(50)
    }).allow(null)
}).min(1);
// ID validation schema for path parameters
exports.idParamsSchema = joi_1.default.object({
    id: joi_1.default.string().trim().min(8).max(128).required()
});
// User ID validation schema for path parameters (Firebase UID format)
exports.userIdParamsSchema = joi_1.default.object({
    userId: joi_1.default.string()
        .trim()
        .pattern(/^[a-zA-Z0-9_-]{20,128}$/)
        .required()
        .messages({
        'string.pattern.base': 'Invalid user ID format',
        'any.required': 'User ID is required'
    })
});
// Stock symbol validation schema for path parameters
exports.stockSymbolParamsSchema = joi_1.default.object({
    symbol: joi_1.default.string()
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
exports.paginationQuerySchema = joi_1.default.object({
    /** Number of items to return (1-100, default: 50) */
    limit: joi_1.default.number().integer().min(1).max(100).default(50),
    /** Cursor for pagination (document ID to start after) */
    cursor: joi_1.default.string().trim().min(8).max(128).optional(),
    /** Sort order: 'asc' or 'desc' (default: 'desc') */
    sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc'),
    /** Field to sort by (default: 'date' for expenses, 'createdAt' for others) */
    sortBy: joi_1.default.string().valid('date', 'createdAt', 'amount', 'name').default('date')
});
// Expenses-specific pagination with date filtering
exports.expensesPaginationSchema = exports.paginationQuerySchema.keys({
    /** Filter by category */
    category: joi_1.default.string().trim().max(50).optional(),
    /** Filter by start date (ISO format) */
    startDate: joi_1.default.string().isoDate().optional(),
    /** Filter by end date (ISO format) */
    endDate: joi_1.default.string().isoDate().optional()
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
exports.budgetsPaginationSchema = exports.paginationQuerySchema.keys({
    /** Filter by period type */
    period: joi_1.default.string().valid('daily', 'weekly', 'monthly', 'yearly').optional(),
    /** Filter active budgets only */
    activeOnly: joi_1.default.boolean().default(false)
}).keys({
    sortBy: joi_1.default.string().valid('createdAt', 'amount', 'name', 'startDate').default('createdAt')
});
