import { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set NODE_ENV if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  }
}));

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || [
  'https://sokin.app',
  'https://sokin-frontend.vercel.app',
  'https://sokin-frontend-git-main-lichorish-gmailcoms-projects.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Sokin Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/*'
    },
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// Import routes
import expenseRoutes from '../src/routes/expenses';
import userRoutes from '../src/routes/users';
import budgetRoutes from '../src/routes/budgets';
import receiptRoutes from '../src/routes/receiptRoutes';
import notificationRoutes from '../src/routes/notificationRoutes';
import goalsRoutes from '../src/routes/goalsRoutes';
import billRemindersRoutes from '../src/routes/billRemindersRoutes';
import stocksRoutes from '../src/routes/stocksRoutes';
import netWorthRoutes from '../src/routes/netWorthRoutes';
import dashboardRoutes from '../src/routes/dashboard';

// Mount routes
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

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    message: `Cannot ${req.method} ${req.path}`,
    availableRoutes: [
      '/',
      '/health',
      '/api/expenses',
      '/api/users',
      '/api/budgets',
      '/api/receipts',
      '/api/notifications',
      '/api/goals',
      '/api/bill-reminders',
      '/api/stocks',
      '/api/net-worth',
      '/api/dashboard'
    ]
  });
});

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        console.error('Express error:', err);
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}
