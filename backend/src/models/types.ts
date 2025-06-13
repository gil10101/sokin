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
  amount: number;
  date: string;
  method: 'manual' | 'automatic' | 'roundup';
  source?: string; // bank account, cash, etc.
} 