import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set NODE_ENV to development if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

// Import utilities
import logger from './utils/logger';

// Initialize Firebase - this is now handled in the config/firebase.ts file
import './config/firebase';

// Import middleware
import { rateLimiter, clearRateLimits } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

// Create Express app
const app = express();
const port = process.env.PORT || '5001';

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:5000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all requests
// More lenient in development mode
const rateLimiterConfig = process.env.NODE_ENV === 'development'
  ? rateLimiter(1000, 60 * 1000) // 1000 requests per minute in dev
  : rateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes in prod

app.use(rateLimiterConfig);

// Lazy load routes for better startup performance
const lazyRoutes = {
  expenseRoutes: () => import('./routes/expenses'),
  userRoutes: () => import('./routes/users'),
  budgetRoutes: () => import('./routes/budgets'),
  receiptRoutes: () => import('./routes/receiptRoutes'),
  notificationRoutes: () => import('./routes/notificationRoutes'),
  goalsRoutes: () => import('./routes/goalsRoutes'),
  billRemindersRoutes: () => import('./routes/billRemindersRoutes'),
  stocksRoutes: () => import('./routes/stocksRoutes'),
  netWorthRoutes: () => import('./routes/netWorthRoutes'),
  dashboardRoutes: () => import('./routes/dashboard'),
};

// Middleware to lazy load routes on first request
const lazyRouteLoader = (routeName: keyof typeof lazyRoutes) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const routeModule = await lazyRoutes[routeName]();
      const routeHandler = routeModule.default;
      return routeHandler(req, res, next);
    } catch (error) {
      logger.error(`Failed to load route ${routeName}:`, { error: String(error) });
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Use lazy-loaded routes
app.use('/api/expenses', lazyRouteLoader('expenseRoutes'));
app.use('/api/users', lazyRouteLoader('userRoutes'));
app.use('/api/budgets', lazyRouteLoader('budgetRoutes'));
app.use('/api/receipts', lazyRouteLoader('receiptRoutes'));
app.use('/api/notifications', lazyRouteLoader('notificationRoutes'));
app.use('/api/goals', lazyRouteLoader('goalsRoutes'));
app.use('/api/bill-reminders', lazyRouteLoader('billRemindersRoutes'));
app.use('/api/stocks', lazyRouteLoader('stocksRoutes'));
app.use('/api/net-worth', lazyRouteLoader('netWorthRoutes'));
app.use('/api/dashboard', lazyRouteLoader('dashboardRoutes'));

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(Number(port), () => {
  logger.info(`Server running on port ${port}`);
  if (process.env.NODE_ENV === 'development') {
    logger.info('Running in development mode with mock data');
    logger.info(`CORS configured for: ${process.env.CORS_ORIGIN || 'configured origin'}`);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Promise Rejection', { error: err });
  // In production, consider graceful shutdown:
  // process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception', { error: err });
  // In production, consider graceful shutdown:
  // process.exit(1);
}); 