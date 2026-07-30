import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const isServerless = process.env.VERCEL === '1';

// Default NODE_ENV by environment: production on Vercel, development locally
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = isServerless ? 'production' : 'development';
}

const isProduction = process.env.NODE_ENV === 'production';

// Import utilities
import logger from './utils/logger';

// Initialize Firebase - this is now handled in the config/firebase.ts file
import { auth, db, storage } from './config/firebase';

// Import middleware
import { rateLimiter, clearRateLimits } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { validateAuthConfig } from './middleware/auth';

// Abort startup on misconfiguration: throw in serverless (fails the
// function init), exit locally.
const fatalConfig = (message: string): never => {
  logger.error(message);
  if (isServerless) {
    throw new Error(message);
  }
  process.exit(1);
};

const validateCriticalConfig = (): void => {
  if (!isProduction) return;

  const errors: string[] = [];

  const hasFirebaseServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT;
  const hasFirebaseServiceAccountEnv = !!(
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PROJECT_ID
  );

  if (!process.env.FIREBASE_PROJECT_ID) {
    errors.push('FIREBASE_PROJECT_ID is required');
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    errors.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is required');
  }
  if (!hasFirebaseServiceAccountJson && !hasFirebaseServiceAccountEnv) {
    errors.push('Firebase Admin service account credentials are required');
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
  }

  if (!process.env.FINNHUB_API_KEY) {
    errors.push('FINNHUB_API_KEY is required');
  }

  if (!auth || !db || !storage) {
    errors.push('Firebase Admin services failed to initialize');
  }

  try {
    validateAuthConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown auth config error';
    errors.push(message);
  }

  if (errors.length > 0) {
    fatalConfig(`Critical configuration errors:\n${errors.join('\n')}`);
  }
};

// Create Express app
const app = express();
const port = process.env.PORT || '5001';

// Behind Vercel's proxy req.ip must come from X-Forwarded-For, otherwise
// rate-limit keys and IP allowlists see the platform's internal address.
app.set('trust proxy', 1);

// Parse and validate CORS origins
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean);

// Validate no wildcards when credentials are enabled (required by CORS spec)
if (corsOrigins?.includes('*')) {
  fatalConfig('CORS_ORIGIN cannot contain "*" when credentials are enabled - browsers will block all requests');
}

// In production, CORS must be explicitly configured
if (isProduction && (!corsOrigins || corsOrigins.length === 0)) {
  fatalConfig('CORS_ORIGIN environment variable must be configured in production');
}

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiting to all requests
// More lenient in development mode
const rateLimiterConfig = process.env.NODE_ENV === 'development'
  ? rateLimiter(1000, 60 * 1000) // 1000 requests per minute in dev
  : rateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes in prod

app.use(rateLimiterConfig);

// Import routes directly (serverless functions are stateless anyway)
import expenseRoutes from './routes/expenses';
import userRoutes from './routes/users';
import budgetRoutes from './routes/budgets';
import receiptRoutes from './routes/receiptRoutes';
import notificationRoutes from './routes/notificationRoutes';
import goalsRoutes from './routes/goalsRoutes';
import billRemindersRoutes from './routes/billRemindersRoutes';
import stocksRoutes from './routes/stocksRoutes';
import netWorthRoutes from './routes/netWorthRoutes';
import dashboardRoutes from './routes/dashboard';
import subscriptionsRoutes from './routes/subscriptionsRoutes';

// Mount routes
// Note: User routes consolidated - /api/users handles both profile and user management
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/bill-reminders', billRemindersRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/net-worth', netWorthRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Sokin Backend API',
    status: 'running',
    endpoints: { health: '/health', api: '/api/*' },
    timestamp: new Date().toISOString()
  });
});

// Development endpoint to clear rate limits
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/clear-rate-limits', async (req: Request, res: Response) => {
    try {
      await clearRateLimits();
      res.json({ message: 'Rate limits cleared successfully' });
    } catch (error) {
      logger.error('Error clearing rate limits:', { error });
      res.status(500).json({ error: 'Failed to clear rate limits' });
    }
  });
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Validate critical configuration before starting server
validateCriticalConfig();

// Start server (only for local development, not in Vercel)
if (!isServerless) {
  app.listen(Number(port), () => {
    logger.info(`Server running on port ${port}`);
    if (process.env.NODE_ENV === 'development') {
      logger.info(`CORS configured for: ${process.env.CORS_ORIGIN || 'configured origin'}`);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err: Error) => {
    logger.error('Unhandled Promise Rejection', { error: err });
    if (isProduction) {
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception', { error: err });
    if (isProduction) {
      process.exit(1);
    }
  });
}

// Export for Vercel serverless
export default app;
