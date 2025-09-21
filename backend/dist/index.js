"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Set NODE_ENV to development if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}
// Import utilities
const logger_1 = __importDefault(require("./utils/logger"));
// Initialize Firebase - this is now handled in the config/firebase.ts file
require("./config/firebase");
// Import middleware
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = require("./middleware/auth");
// Create Express app
const app = (0, express_1.default)();
const port = process.env.PORT || '5001';
// Basic middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Platform'],
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Apply rate limiting to all requests
// More lenient in development mode
const rateLimiterConfig = process.env.NODE_ENV === 'development'
    ? (0, rateLimiter_1.rateLimiter)(1000, 60 * 1000) // 1000 requests per minute in dev
    : (0, rateLimiter_1.rateLimiter)(100, 15 * 60 * 1000); // 100 requests per 15 minutes in prod
app.use(rateLimiterConfig);
// Lazy load routes for better startup performance
const lazyRoutes = {
    expenseRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/expenses'))),
    userRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/users'))),
    budgetRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/budgets'))),
    receiptRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/receiptRoutes'))),
    notificationRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/notificationRoutes'))),
    goalsRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/goalsRoutes'))),
    billRemindersRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/billRemindersRoutes'))),
    stocksRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/stocksRoutes'))),
    netWorthRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/netWorthRoutes'))),
    dashboardRoutes: () => Promise.resolve().then(() => __importStar(require('./routes/dashboard'))),
};
// Middleware to lazy load routes on first request
const lazyRouteLoader = (routeName) => {
    return async (req, res, next) => {
        try {
            const routeModule = await lazyRoutes[routeName]();
            const routeHandler = routeModule.default;
            return routeHandler(req, res, next);
        }
        catch (error) {
            logger_1.default.error(`Failed to load route ${routeName}:`, { error: String(error) });
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
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Development endpoint to clear rate limits
if (process.env.NODE_ENV === 'development') {
    app.post('/dev/clear-rate-limits', async (req, res) => {
        try {
            await (0, rateLimiter_1.clearRateLimits)();
            res.json({ message: 'Rate limits cleared successfully' });
        }
        catch (error) {
            logger_1.default.error('Error clearing rate limits:', { error });
            res.status(500).json({ error: 'Failed to clear rate limits' });
        }
    });
}
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Global error handler
app.use(errorHandler_1.errorHandler);
// Validate configuration before starting server
try {
    (0, auth_1.validateAuthConfig)();
}
catch (error) {
    logger_1.default.error('Configuration validation failed:', { error: String(error) });
    process.exit(1);
}
// Start server
app.listen(Number(port), () => {
    logger_1.default.info(`Server running on port ${port}`);
    if (process.env.NODE_ENV === 'development') {
        logger_1.default.info('Running in development mode with mock data');
        logger_1.default.info(`CORS configured for: ${process.env.CORS_ORIGIN || 'configured origin'}`);
    }
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger_1.default.error('Unhandled Promise Rejection', { error: err });
    // In production, consider graceful shutdown:
    // process.exit(1);
});
// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger_1.default.error('Uncaught Exception', { error: err });
    // In production, consider graceful shutdown:
    // process.exit(1);
});
