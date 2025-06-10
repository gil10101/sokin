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
}

export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
  settings?: UserSettings;
}

export interface UserSettings {
  currency?: string;
  language?: string;
  theme?: 'light' | 'dark';
  notificationsEnabled?: boolean;
} 