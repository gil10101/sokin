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
  amount: number;
  date: string;
  category: string;
  description: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  receipt?: string;
}

export interface ExpenseFormData {
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