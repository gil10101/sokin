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
const port = process.env.PORT || 5001;

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all requests
// More lenient in development mode
const maxRequests = process.env.NODE_ENV === 'development' ? 1000 : 100;
const windowMs = process.env.NODE_ENV === 'development' ? 60 * 1000 : 15 * 60 * 1000; // 1 minute in dev, 15 minutes in prod
app.use(rateLimiter(maxRequests, windowMs));

// Routes
import expenseRoutes from './routes/expenses';
import userRoutes from './routes/users';
import budgetRoutes from './routes/budgets';
import receiptRoutes from './routes/receiptRoutes';
import notificationRoutes from './routes/notificationRoutes';
import goalsRoutes from './routes/goalsRoutes';
import billRemindersRoutes from './routes/billRemindersRoutes';
import stocksRoutes from './routes/stocksRoutes';
import netWorthRoutes from './routes/netWorthRoutes';

app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/bill-reminders', billRemindersRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/net-worth', netWorthRoutes);

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Development endpoint to clear rate limits
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/clear-rate-limits', (req: Request, res: Response) => {
    clearRateLimits();
    res.json({ message: 'Rate limits cleared' });
  });
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  if (process.env.NODE_ENV === 'development') {
    logger.info('Running in development mode with mock data');
    logger.info('CORS configured for: http://localhost:3000');
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