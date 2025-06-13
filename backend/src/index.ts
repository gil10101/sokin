import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import utilities
import logger from './utils/logger';

// Initialize Firebase - this is now handled in the config/firebase.ts file
import './config/firebase';

// Import middleware
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

// Create Express app
const app = express();
const port = process.env.PORT || 5001;

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all requests
app.use(rateLimiter(100, 15 * 60 * 1000)); // 100 requests per 15 minutes

// Routes
import expenseRoutes from './routes/expenses';
import userRoutes from './routes/users';
import budgetRoutes from './routes/budgets';
import receiptRoutes from './routes/receiptRoutes';
import notificationRoutes from './routes/notificationRoutes';
import goalsRoutes from './routes/goalsRoutes';
import billRemindersRoutes from './routes/billRemindersRoutes';

app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/bill-reminders', billRemindersRoutes);

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
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