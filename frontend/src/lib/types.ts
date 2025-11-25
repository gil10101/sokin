// User-related types
export interface User {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  createdAt: string;
  settings: {
    currency: string;
    theme: string;
    notifications: {
      email: boolean;
      push: boolean;
      monthlyReport: boolean;
      budgetAlerts: boolean;
    };
  };
}

// Expense-related types
export interface Expense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  date: string | number | Date | { toDate: () => Date };
  category: string;
  description?: string;
  tags?: string[];
  receiptImageUrl?: string;
  receiptData?: any;
  createdAt: string;
  updatedAt?: string;
  receipt?: string;
}

export interface ExpenseFormData {
  name: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  tags?: string[];
  receipt?: File | null;
}

// Budget-related types
export interface Budget {
  id: string;
  userId: string;
  category: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BudgetFormData {
  category: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
}

// Net Worth and Asset/Liability Types
export interface Asset {
  id?: string;
  userId: string;
  type: AssetType;
  category: AssetCategory;
  name: string;
  currentValue: number;
  description?: string;
  metadata?: AssetMetadata;
  lastUpdated: string;
  createdAt: string;
  updatedAt?: string;
}

export type AssetCategory = 
  | 'bank_accounts' 
  | 'investment_accounts' 
  | 'real_estate' 
  | 'vehicles' 
  | 'other_valuables';

export type AssetType = 
  // Bank Accounts
  | 'checking' 
  | 'savings' 
  | 'money_market'
  | 'cd'
  // Investment Accounts
  | 'stocks' 
  | 'crypto' 
  | 'retirement_401k' 
  | 'retirement_ira' 
  | 'mutual_funds'
  | 'bonds'
  | 'brokerage'
  // Real Estate
  | 'primary_residence' 
  | 'rental_property' 
  | 'commercial_property'
  | 'land'
  // Vehicles
  | 'car' 
  | 'truck' 
  | 'motorcycle' 
  | 'boat'
  | 'rv'
  // Other Valuables
  | 'collectibles' 
  | 'business_ownership' 
  | 'jewelry'
  | 'art'
  | 'other';

export interface AssetMetadata {
  // Bank Account specific
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
  
  // Investment specific  
  platform?: string;
  investmentType?: string;
  ticker?: string;
  shares?: number;
  
  // Real Estate specific
  address?: string;
  propertyType?: string;
  purchasePrice?: number;
  purchaseDate?: string;
  mortgageBalance?: number;
  
  // Vehicle specific
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  vin?: string;
  
  // General
  notes?: string;
  lastValuationDate?: string;
  valuationMethod?: 'manual' | 'api' | 'estimated';
}

export interface Liability {
  id?: string;
  userId: string;
  type: LiabilityType;
  category: LiabilityCategory;
  name: string;
  currentBalance: number;
  originalAmount?: number;
  interestRate?: number;
  minimumPayment?: number;
  dueDate?: string;
  metadata?: LiabilityMetadata;
  createdAt: string;
  updatedAt?: string;
}

export type LiabilityCategory = 
  | 'credit_cards' 
  | 'mortgages' 
  | 'student_loans' 
  | 'auto_loans' 
  | 'personal_loans' 
  | 'other_debts';

export type LiabilityType = 
  // Credit Cards
  | 'credit_card'
  | 'store_card'
  | 'business_card'
  // Mortgages
  | 'primary_mortgage'
  | 'second_mortgage'
  | 'heloc'
  // Student Loans
  | 'federal_student_loan'
  | 'private_student_loan'
  // Auto Loans
  | 'car_loan'
  | 'truck_loan'
  | 'motorcycle_loan'
  // Personal Loans
  | 'personal_loan'
  | 'payday_loan'
  | 'medical_debt'
  // Other
  | 'business_loan'
  | 'family_loan'
  | 'other';

export interface LiabilityMetadata {
  // Credit Card specific
  creditLimit?: number;
  issuer?: string;
  cardNumber?: string;
  
  // Loan specific
  lender?: string;
  loanTerm?: number; // months
  payoffDate?: string;
  
  // Mortgage specific
  propertyAddress?: string;
  
  // General
  accountNumber?: string;
  notes?: string;
  autoPayEnabled?: boolean;
  linkedBankAccount?: string;
}

export interface NetWorthSnapshot {
  id?: string;
  userId: string;
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assetBreakdown: AssetBreakdown;
  liabilityBreakdown: LiabilityBreakdown;
  createdAt: string;
  metadata?: {
    calculationMethod?: 'manual' | 'automatic';
    notes?: string;
    monthlyChange?: number;
    monthlyChangePercent?: number;
  };
}

export interface AssetBreakdown {
  bankAccounts: number;
  investmentAccounts: number;
  realEstate: number;
  vehicles: number;
  otherValuables: number;
}

export interface LiabilityBreakdown {
  creditCards: number;
  mortgages: number;
  studentLoans: number;
  autoLoans: number;
  personalLoans: number;
  otherDebts: number;
}

export interface NetWorthCalculation {
  userId: string;
  calculatedAt: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetBreakdown: AssetBreakdown;
  liabilityBreakdown: LiabilityBreakdown;
  assets: Asset[];
  liabilities: Liability[];
  monthlyChange?: number;
  monthlyChangePercent?: number;
}

export interface NetWorthTrend {
  period: string; // YYYY-MM format
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyChange: number;
  monthlyChangePercent: number;
}

export interface NetWorthInsight {
  type: 'positive' | 'warning' | 'info';
  title: string;
  description: string;
  value?: number;
  category?: string;
  actionable?: boolean;
  priority: 'low' | 'medium' | 'high';
}

// Form data types for frontend
export interface AssetFormData {
  type: AssetType;
  category: AssetCategory;
  name: string;
  currentValue: number;
  description?: string;
  metadata?: AssetMetadata;
}

export interface LiabilityFormData {
  type: LiabilityType;
  category: LiabilityCategory;
  name: string;
  currentBalance: number;
  originalAmount?: number;
  interestRate?: number;
  minimumPayment?: number;
  dueDate?: string;
  metadata?: LiabilityMetadata;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// Notification types
export interface Notification {
  id: number | string;
  title: string;
  message: string;
  time: string;
  read: boolean;
} 