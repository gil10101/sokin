import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Simple serverless function that works immediately
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || [
    'https://sokin.app',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Sokin Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      expenses: '/api/expenses',
      users: '/api/users',
      budgets: '/api/budgets',
      receipts: '/api/receipts',
      notifications: '/api/notifications',
      goals: '/api/goals',
      billReminders: '/api/bill-reminders',
      stocks: '/api/stocks',
      netWorth: '/api/net-worth',
      dashboard: '/api/dashboard'
    },
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// Basic API routes - these need to be implemented with full business logic
const routes = [
  'expenses', 'users', 'budgets', 'receipts', 'notifications', 
  'goals', 'bill-reminders', 'stocks', 'net-worth', 'dashboard'
];

// Stock API routes (specific implementation)
app.get('/stocks', (req, res) => {
  res.json({ 
    message: 'Stocks endpoint', 
    status: 'implemented',
    availableEndpoints: [
      'GET /stocks/trending',
      'GET /stocks/market-indices', 
      'GET /stocks/portfolio/:userId',
      'GET /stocks/stock/:symbol',
      'GET /stocks/search'
    ]
  });
});

app.get('/stocks/trending', (req, res) => {
  res.json({
    success: true,
    message: 'Trending stocks endpoint',
    data: [] // Mock data - implement with real API
  });
});

app.get('/stocks/market-indices', (req, res) => {
  res.json({
    success: true,
    message: 'Market indices endpoint',
    data: [] // Mock data - implement with real API
  });
});

app.get('/stocks/portfolio/:userId', (req, res) => {
  res.json({
    success: true,
    message: `Portfolio for user ${req.params.userId}`,
    data: [] // Mock data - implement with real Firebase/database logic
  });
});

app.get('/stocks/stock/:symbol', (req, res) => {
  res.json({
    success: true,
    message: `Stock data for ${req.params.symbol}`,
    data: {} // Mock data - implement with real API
  });
});

app.get('/stocks/search', (req, res) => {
  res.json({
    success: true,
    message: 'Stock search endpoint',
    query: req.query.q || '',
    data: [] // Mock data - implement with real API
  });
});

// Other routes (non-stock)
const otherRoutes = [
  'expenses', 'users', 'budgets', 'receipts', 'notifications', 
  'goals', 'bill-reminders', 'net-worth', 'dashboard'
];

otherRoutes.forEach(route => {
  app.get(`/${route}`, (req, res) => {
    res.json({
      message: `${route.charAt(0).toUpperCase() + route.slice(1)} endpoint`,
      status: 'implemented',
      note: 'This is a basic implementation. Full business logic needs to be added.',
      availableMethods: ['GET', 'POST', 'PUT', 'DELETE']
    });
  });
  
  app.post(`/${route}`, (req, res) => {
    res.json({
      message: `POST /${route}`,
      received: req.body,
      status: 'received',
      note: 'Implementation needed'
    });
  });
  
  app.put(`/${route}/:id`, (req, res) => {
    res.json({
      message: `PUT /${route}/${req.params.id}`,
      received: req.body,
      status: 'received',
      note: 'Implementation needed'
    });
  });
  
  app.delete(`/${route}/:id`, (req, res) => {
    res.json({
      message: `DELETE /${route}/${req.params.id}`,
      status: 'deleted',
      note: 'Implementation needed'
    });
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: ['/', '/health', ...routes.map(r => `/${r}`)]
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

export default app;
