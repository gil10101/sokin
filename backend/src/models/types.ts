export interface Expense {
  id?: string;
  userId: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface Budget {
  id?: string;
  userId: string;
  name: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  categories?: string[];
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt?: string;
  // Enhanced budget features
  alertThresholds?: BudgetAlertThreshold[];
  currentSpent?: number;
  remainingAmount?: number;
  isActive?: boolean;
}

export interface BudgetAlertThreshold {
  percentage: number; // e.g., 50, 75, 90, 100
  type: 'warning' | 'danger' | 'exceeded';
  notified?: boolean;
}

export interface Notification {
  id?: string;
  userId: string;
  type: 'budget_warning' | 'budget_exceeded' | 'bill_reminder' | 'goal_milestone' | 'spending_insight';
  title: string;
  message: string;
  data?: any; // Additional context data
  read: boolean;
  createdAt: string;
  scheduledFor?: string; // For future notifications
  priority: 'low' | 'medium' | 'high';
}

export interface NotificationPreferences {
  userId: string;
  budgetAlerts: boolean;
  billReminders: boolean;
  goalMilestones: boolean;
  spendingInsights: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications?: boolean;
  // Specific thresholds
  budgetWarningThreshold: number; // Default 80%
  budgetExceededThreshold: number; // Default 100%
  reminderDaysBefore: number; // Days before bill due date
}

export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
  settings?: UserSettings;
  notificationPreferences?: NotificationPreferences;
  fcmTokens?: string[]; // For push notifications
}

export interface UserSettings {
  currency?: string;
  language?: string;
  theme?: 'light' | 'dark';
  notificationsEnabled?: boolean;
  // Savings preferences
  defaultSavingsCategory?: string;
  roundUpSavings?: boolean;
  savingsReminders?: boolean;
}

export interface SavingsGoal {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: 'emergency' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'other';
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  // Auto-saving settings
  autoSaveEnabled?: boolean;
  autoSaveAmount?: number;
  autoSaveFrequency?: 'daily' | 'weekly' | 'monthly';
  linkedBankAccount?: string;
  // Progress tracking
  milestones?: GoalMilestone[];
  contributions?: GoalContribution[];
}

export interface GoalMilestone {
  percentage: number; // 25%, 50%, 75%, 100%
  amount: number;
  achievedAt?: string;
  celebrated?: boolean;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  method: 'manual' | 'automatic' | 'roundup';
  source?: string; // bank account, cash, etc.
  note?: string; // user description/note
}

// Net Worth and Asset/Liability Management Types

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
  accountNumber?: string; // Should be encrypted/masked
  
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
  vin?: string; // Should be encrypted
  
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
  cardNumber?: string; // Should be encrypted/masked
  
  // Loan specific
  lender?: string;
  loanTerm?: number; // months
  payoffDate?: string;
  
  // Mortgage specific
  propertyAddress?: string;
  
  // General
  accountNumber?: string; // Should be encrypted/masked
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

// Asset/Liability Management Request Types
export interface CreateAssetRequest {
  type: AssetType;
  category: AssetCategory;
  name: string;
  currentValue: number;
  description?: string;
  metadata?: AssetMetadata;
}

export interface UpdateAssetRequest {
  name?: string;
  currentValue?: number;
  description?: string;
  metadata?: AssetMetadata;
}

export interface CreateLiabilityRequest {
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

export interface UpdateLiabilityRequest {
  name?: string;
  currentBalance?: number;
  interestRate?: number;
  minimumPayment?: number;
  dueDate?: string;
  metadata?: LiabilityMetadata;
}

// Net Worth Analytics Types
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