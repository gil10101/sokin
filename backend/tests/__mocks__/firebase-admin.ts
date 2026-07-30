/**
 * Firebase Admin SDK Mock
 * 
 * Mocks Firebase Admin SDK for unit testing without requiring
 * actual Firebase credentials or network connectivity.
 * 
 * Document structures match actual Firestore schema from production.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Mock data matching actual Firestore document schemas
 */
export const mockExpenseData = {
  id: 'expense-test-123',
  userId: 'test-user-123',
  name: 'Test Expense',
  amount: 100.50,
  date: new Date('2025-01-15T10:30:00.000Z'),
  category: 'Food',
  description: 'Lunch at restaurant',
  tags: ['food', 'lunch'],
  createdAt: new Date('2025-01-15T10:30:00.000Z'),
  updatedAt: new Date('2025-01-15T10:30:00.000Z'),
};

export const mockBudgetData = {
  id: 'budget-test-123',
  userId: 'test-user-123',
  name: 'Monthly Food Budget',
  amount: 500,
  period: 'monthly',
  categories: ['Food', 'Dining'],
  startDate: new Date('2025-01-01T00:00:00.000Z'),
  endDate: null,
  isActive: true,
  currentSpent: 150,
  remainingAmount: 350,
  alertThresholds: [
    { percentage: 80, type: 'warning', notified: false },
    { percentage: 100, type: 'exceeded', notified: false },
  ],
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-15T10:30:00.000Z'),
};

export const mockGoalData = {
  id: 'goal-test-123',
  userId: 'test-user-123',
  name: 'Emergency Fund',
  description: 'Build emergency savings',
  targetAmount: 10000,
  currentAmount: 2500,
  targetDate: '2026-01-01T00:00:00.000Z',
  category: 'savings',
  priority: 'high',
  isCompleted: false,
  contributions: [
    {
      id: 'contrib_1234567890_abc123',
      amount: 500,
      date: '2025-01-15T10:30:00.000Z',
      method: 'manual',
      source: 'Manual Entry',
      note: 'Monthly contribution',
    },
  ],
  milestones: [
    { percentage: 25, amount: 2500, achievedAt: '2025-01-15T10:30:00.000Z' },
    { percentage: 50, amount: 5000, achievedAt: null },
    { percentage: 75, amount: 7500, achievedAt: null },
    { percentage: 100, amount: 10000, achievedAt: null },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-15T10:30:00.000Z',
};

export const mockBillReminderData = {
  id: 'bill-test-123',
  userId: 'test-user-123',
  name: 'Electric Bill',
  amount: 150,
  dueDate: '2025-02-01T00:00:00.000Z',
  frequency: 'monthly' as const,
  category: 'utilities',
  description: 'Monthly electricity payment',
  isPaid: false,
  paidDate: undefined,
  reminderDays: [7, 3, 1],
  autoPayEnabled: false,
  linkedAccount: undefined,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-15T10:30:00.000Z',
};

export const mockNotificationData = {
  id: 'notification-test-123',
  userId: 'test-user-123',
  type: 'budget_warning',
  title: 'Budget Warning',
  message: 'You have spent 80% of your Food budget',
  read: false,
  priority: 'medium',
  data: {
    budgetId: 'budget-123',
    currentSpent: 400,
    budgetAmount: 500,
    percentage: 80,
  },
  createdAt: new Date('2025-01-15T10:30:00.000Z'),
  updatedAt: new Date('2025-01-15T10:30:00.000Z'),
};

export const mockAssetData = {
  id: 'asset-test-123',
  userId: 'test-user-123',
  type: 'checking',
  category: 'bank_accounts',
  name: 'Main Checking Account',
  currentValue: 5000,
  description: 'Primary checking account',
  metadata: {},
  lastUpdated: '2025-01-15T10:30:00.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
};

export const mockLiabilityData = {
  id: 'liability-test-123',
  userId: 'test-user-123',
  type: 'credit_card',
  category: 'credit_cards',
  name: 'Visa Credit Card',
  currentBalance: 2500,
  originalAmount: 5000,
  interestRate: 19.99,
  minimumPayment: 50,
  dueDate: '2025-02-15T00:00:00.000Z',
  metadata: {
    notes: 'Primary credit card',
  },
  createdAt: '2025-01-01T00:00:00.000Z',
};

export const mockStockTransactionData = {
  id: 'txn-test-123',
  userId: 'test-user-123',
  symbol: 'AAPL',
  transactionType: 'buy',
  shares: 10.5,
  pricePerShare: 175.50,
  totalAmount: 1842.75,
  transactionDate: '2025-01-15T10:30:00.000Z',
  createdAt: '2025-01-15T10:30:00.000Z',
  timestamp: new Date('2025-01-15T10:30:00.000Z'),
};

export const mockUserProfileData = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  createdAt: '1704067200000', // Milliseconds timestamp string
  lastSignedInAt: '1705363200000',
  notificationPreferences: {
    budgetAlerts: true,
    billReminders: true,
    goalMilestones: true,
    spendingInsights: true,
    pushNotifications: true,
    emailNotifications: false,
    budgetWarningThreshold: 80,
    budgetExceededThreshold: 100,
    reminderDaysBefore: 3,
  },
  fcmTokens: [],
  customCategories: ['Travel', 'Subscriptions'],
};

export const mockNetWorthSnapshotData = {
  id: 'snapshot-test-123',
  userId: 'test-user-123',
  date: '2025-01-15',
  netWorth: 15000,
  totalAssets: 25000,
  totalLiabilities: 10000,
  assetBreakdown: {
    bankAccounts: 10000,
    investmentAccounts: 10000,
    realEstate: 0,
    vehicles: 5000,
    otherValuables: 0,
  },
  liabilityBreakdown: {
    creditCards: 2500,
    mortgages: 0,
    studentLoans: 5000,
    autoLoans: 2500,
    personalLoans: 0,
    otherDebts: 0,
  },
  createdAt: '2025-01-15T10:30:00.000Z',
  metadata: {
    calculationMethod: 'automatic',
    monthlyChange: 500,
    monthlyChangePercent: 3.45,
  },
};

// Mock Firestore document reference
export const mockDocRef = {
  id: 'mock-doc-id',
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Mock Firestore document snapshot with expense data
export const mockDocSnapshot = {
  exists: true,
  id: 'mock-doc-id',
  data: jest.fn(() => ({ ...mockExpenseData })),
  ref: mockDocRef,
};

// Mock Firestore query snapshot
export const mockQuerySnapshot = {
  docs: [mockDocSnapshot],
  empty: false,
  size: 1,
  forEach: jest.fn((callback: (doc: typeof mockDocSnapshot) => void) => {
    [mockDocSnapshot].forEach(callback);
  }),
};

// Mock Firestore query
export const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue(mockQuerySnapshot),
};

// Mock Firestore collection reference
export const mockCollectionRef = {
  doc: jest.fn(() => mockDocRef),
  add: jest.fn().mockResolvedValue(mockDocRef),
  where: jest.fn(() => mockQuery),
  orderBy: jest.fn(() => mockQuery),
  limit: jest.fn(() => mockQuery),
  get: jest.fn().mockResolvedValue(mockQuerySnapshot),
};

// Mock Firestore instance
export const mockFirestore = {
  collection: jest.fn(() => mockCollectionRef),
  doc: jest.fn(() => mockDocRef),
  batch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  runTransaction: jest.fn((callback: any) => callback({
    get: jest.fn().mockResolvedValue(mockDocSnapshot),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })),
};

// Mock Firebase Auth decoded token
export const mockDecodedToken = {
  uid: 'test-user-123',
  email: 'test@example.com',
  email_verified: true,
  aud: 'test-project',
  iss: 'https://securetoken.google.com/test-project',
  sub: 'test-user-123',
  auth_time: Math.floor(Date.now() / 1000),
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

// Mock Firebase Auth user record
export const mockUserRecord = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  disabled: false,
  metadata: {
    creationTime: '2025-01-01T00:00:00.000Z',
    lastSignInTime: '2025-01-15T10:30:00.000Z',
  },
};

// Mock Firebase Auth
export const mockAuth = {
  verifyIdToken: jest.fn().mockResolvedValue(mockDecodedToken),
  getUser: jest.fn().mockResolvedValue(mockUserRecord),
  createUser: jest.fn().mockResolvedValue({
    uid: 'new-user-id',
    email: 'new@example.com',
  }),
  updateUser: jest.fn().mockResolvedValue(mockUserRecord),
  deleteUser: jest.fn().mockResolvedValue(undefined),
};

// Mock Firebase Admin app
export const mockApp = {
  name: '[DEFAULT]',
  options: {
    projectId: 'test-project',
  },
};

// Mock credential
export const mockCredential = {
  cert: jest.fn().mockReturnValue({
    projectId: 'test-project',
    clientEmail: 'test@test-project.iam.gserviceaccount.com',
    privateKey: 'mock-private-key',
  }),
  applicationDefault: jest.fn().mockReturnValue({}),
};

// Firebase Admin module mock
const firebaseAdmin = {
  apps: [mockApp],
  initializeApp: jest.fn().mockReturnValue(mockApp),
  credential: mockCredential,
  firestore: jest.fn(() => mockFirestore),
  auth: jest.fn(() => mockAuth),
  app: jest.fn(() => mockApp),
};

// Reset all mocks helper
export const resetFirebaseMocks = (): void => {
  Object.values(mockDocRef).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as jest.Mock).mockClear();
    }
  });
  Object.values(mockCollectionRef).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as jest.Mock).mockClear();
    }
  });
  Object.values(mockFirestore).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as jest.Mock).mockClear();
    }
  });
  Object.values(mockAuth).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as jest.Mock).mockClear();
    }
  });
  
  // Reset document snapshot data to default expense
  mockDocSnapshot.data = jest.fn(() => ({ ...mockExpenseData }));
  mockDocSnapshot.exists = true;
};

// Setup mock for specific document data
export const mockDocumentData = (data: Record<string, unknown>): void => {
  (mockDocSnapshot as any).data = jest.fn(() => data);
  mockDocRef.get.mockResolvedValue(mockDocSnapshot);
};

// Setup mock for collection query results
export const mockQueryResults = (docs: Array<Record<string, unknown>>): void => {
  const snapshots = docs.map((data, index) => ({
    exists: true,
    id: `doc-${index}`,
    data: jest.fn(() => data),
    ref: mockDocRef,
  }));
  
  (mockQuerySnapshot as any).docs = snapshots;
  (mockQuerySnapshot as any).size = docs.length;
  (mockQuerySnapshot as any).empty = docs.length === 0;
  (mockQuerySnapshot as any).forEach = jest.fn((callback: any) => {
    snapshots.forEach(callback);
  });
};

// Helper to create mock expense document
export const createMockExpense = (overrides: Partial<typeof mockExpenseData> = {}) => ({
  ...mockExpenseData,
  ...overrides,
});

// Helper to create mock budget document
export const createMockBudget = (overrides: Partial<typeof mockBudgetData> = {}) => ({
  ...mockBudgetData,
  ...overrides,
});

// Helper to create mock goal document
export const createMockGoal = (overrides: Partial<typeof mockGoalData> = {}) => ({
  ...mockGoalData,
  ...overrides,
});

// Helper to create mock bill reminder document
export const createMockBillReminder = (overrides: Partial<typeof mockBillReminderData> = {}) => ({
  ...mockBillReminderData,
  ...overrides,
});

// Helper to create mock notification document
export const createMockNotification = (overrides: Partial<typeof mockNotificationData> = {}) => ({
  ...mockNotificationData,
  ...overrides,
});

// Helper to create mock asset document
export const createMockAsset = (overrides: Partial<typeof mockAssetData> = {}) => ({
  ...mockAssetData,
  ...overrides,
});

// Helper to create mock liability document
export const createMockLiability = (overrides: Partial<typeof mockLiabilityData> = {}) => ({
  ...mockLiabilityData,
  ...overrides,
});

// Helper to create mock stock transaction document
export const createMockStockTransaction = (overrides: Partial<typeof mockStockTransactionData> = {}) => ({
  ...mockStockTransactionData,
  ...overrides,
});

export default firebaseAdmin;
